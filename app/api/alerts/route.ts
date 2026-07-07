import { NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription, recentUnverifiedCount } from "@/lib/alerts";
import { getResend, FROM_EMAIL } from "@/lib/email";
import { PROJECT_TYPES } from "@/lib/types";

const BodySchema = z.object({
  email: z.string().email(),
  addressLabel: z.string().min(2).max(200),
  lat: z.number().min(39).max(41),
  lng: z.number().min(-76).max(-74),
  radiusMeters: z.number().int().min(100).max(10000),
  projectTypes: z.array(z.enum(PROJECT_TYPES as [string, ...string[]])).min(1),
});

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid input", details: parsed.error.flatten() }, { status: 400 });
  }

  // Throttle mailbombing: cap unverified confirmation emails per address/hour.
  // Return ok regardless so we don't reveal whether the email is already on file.
  if (await recentUnverifiedCount(parsed.data.email) >= 3) {
    return NextResponse.json({ ok: true });
  }

  const sub = await createSubscription({
    email: parsed.data.email,
    addressLabel: parsed.data.addressLabel,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radiusMeters: parsed.data.radiusMeters,
    projectTypes: parsed.data.projectTypes as never,
  });

  // Build confirmation links from a trusted, server-configured origin only.
  // The Origin/Host headers are attacker-controllable, so deriving the link from
  // them would let a forged request mint a verify link pointing at an attacker
  // host that still carries the real token. Fail closed in production.
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (process.env.NODE_ENV !== "production" ? "http://localhost:3000" : null);
  if (!baseUrl) {
    console.error("alerts: NEXT_PUBLIC_BASE_URL is not set; refusing to send with an untrusted origin");
    return NextResponse.json({ error: "server misconfigured" }, { status: 500 });
  }
  const verifyUrl = `${baseUrl}/api/alerts/verify?token=${sub.verify_token}`;
  const unsubUrl = `${baseUrl}/api/alerts/unsubscribe?token=${sub.unsubscribe_token}`;

  const resend = getResend();
  if (resend) {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: sub.email,
      subject: "Confirm your civic-philly alerts",
      text:
`Confirm your alert subscription for projects near ${sub.address_label}.

Click to confirm: ${verifyUrl}

If you didn't sign up, ignore this email or unsubscribe: ${unsubUrl}
`,
    }).catch((e) => { console.error("resend error", e); });
  } else {
    // dev convenience: log the link so you can click through without Resend.
    console.log(`[alerts] verify ${sub.email}: ${verifyUrl}`);
  }

  return NextResponse.json({ ok: true });
}
