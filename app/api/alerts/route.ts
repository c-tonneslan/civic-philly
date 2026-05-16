import { NextResponse } from "next/server";
import { z } from "zod";
import { createSubscription } from "@/lib/alerts";
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

  const sub = await createSubscription({
    email: parsed.data.email,
    addressLabel: parsed.data.addressLabel,
    lat: parsed.data.lat,
    lng: parsed.data.lng,
    radiusMeters: parsed.data.radiusMeters,
    projectTypes: parsed.data.projectTypes as never,
  });

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL
    || (req.headers.get("origin") ?? "http://localhost:3000");
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
