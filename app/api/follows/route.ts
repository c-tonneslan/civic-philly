import { NextResponse } from "next/server";
import { z } from "zod";
import { createFollow, recentUnverifiedFollowCount, describeFollowTarget } from "@/lib/follows";
import { getResend, FROM_EMAIL } from "@/lib/email";

const BodySchema = z
  .object({
    email: z.string().email(),
    targetType: z.enum(["project", "developer", "district"]),
    targetValue: z.string().min(1).max(200),
  })
  .superRefine((v, ctx) => {
    // project/district follows are consumed as ::bigint by send-alerts.mjs — a
    // non-numeric value there would crash status notifications for EVERY project
    // follower. Reject it at the door.
    if ((v.targetType === "project" || v.targetType === "district") && !/^[0-9]+$/.test(v.targetValue)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["targetValue"], message: "must be a numeric id" });
    }
  });

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  // Throttle unverified signups per email; return ok either way so we don't leak
  // whether an email is already on file.
  if (await recentUnverifiedFollowCount(parsed.data.email) >= 3) {
    return NextResponse.json({ ok: true });
  }

  const follow = await createFollow(parsed.data);

  // Build confirmation links from a trusted origin only (see app/api/alerts).
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : null);
  if (!baseUrl) {
    console.error("follows: NEXT_PUBLIC_BASE_URL is not set; refusing untrusted origin");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const verifyUrl = `${baseUrl}/api/follows/verify?token=${follow.verify_token}`;
  const unsubUrl = `${baseUrl}/api/alerts/unsubscribe?token=${follow.unsubscribe_token}`;
  const label = describeFollowTarget(follow.target_type, follow.target_value);

  const resend = getResend();
  if (resend) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: follow.email,
      subject: "Confirm your civic-philly follow",
      text:
`Confirm that you want updates about ${label}.

Click to confirm: ${verifyUrl}

If you didn't sign up, ignore this email or unsubscribe: ${unsubUrl}
`,
    }).catch((e) => { console.error("resend error", e); });
  } else {
    console.log(`[follows] verify ${follow.email}: ${verifyUrl}`);
  }

  return NextResponse.json({ ok: true });
}
