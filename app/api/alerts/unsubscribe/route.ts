import { NextResponse } from "next/server";
import { unsubscribe } from "@/lib/alerts";

export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/alerts/error", req.url));
  await unsubscribe(token);
  return NextResponse.redirect(new URL("/alerts/unsubscribed", req.url));
}
