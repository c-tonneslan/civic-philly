import { NextResponse } from "next/server";
import { verifyFollow } from "@/lib/follows";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/alerts/error", req.url));
  const follow = await verifyFollow(token);
  if (!follow) return NextResponse.redirect(new URL("/alerts/error", req.url));
  return NextResponse.redirect(new URL("/alerts/confirmed", req.url));
}
