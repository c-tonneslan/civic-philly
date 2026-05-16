import { NextResponse } from "next/server";
import { verifySubscription } from "@/lib/alerts";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/alerts/error", req.url));
  const sub = await verifySubscription(token);
  if (!sub) return NextResponse.redirect(new URL("/alerts/error", req.url));
  return NextResponse.redirect(new URL("/alerts/confirmed", req.url));
}
