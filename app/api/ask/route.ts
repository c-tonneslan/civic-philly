import { NextResponse } from "next/server";
import { z } from "zod";
import { getGroqKey, groqChat } from "@/lib/groq";
import { AskResultSchema, buildSystemPrompt, resultToQueryString } from "@/lib/askParse";
import { buildQuery } from "@/lib/queryString";
import { listNeighborhoods } from "@/lib/projects";

export const dynamic = "force-dynamic";

const BodySchema = z.object({ q: z.string().min(1).max(500) });

// The neighborhood allow-list changes rarely; cache it so every question doesn't
// re-query the DB.
let cached: { at: number; list: string[] } | null = null;
async function neighborhoods(): Promise<string[]> {
  if (cached && Date.now() - cached.at < 10 * 60 * 1000) return cached.list;
  const list = await listNeighborhoods().catch(() => []);
  cached = { at: Date.now(), list };
  return list;
}

export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "invalid input" }, { status: 400 });
  const q = parsed.data.q;

  // Feature degrades to plain full-text search when unconfigured — never 500.
  if (!getGroqKey()) return NextResponse.json({ error: "not_configured" }, { status: 501 });

  // Any failure (bad JSON, empty parse, timeout, rate-limit) falls back to
  // treating the whole question as a full-text query.
  const fallback = () => NextResponse.json({ ok: false, fallback: true, query: buildQuery({ q }) });

  const nbhd = await neighborhoods();
  const today = new Date().toISOString().slice(0, 10);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const content = await groqChat(
      [
        { role: "system", content: buildSystemPrompt(nbhd, today) },
        { role: "user", content: q },
      ],
      { signal: controller.signal },
    );
    let obj: unknown;
    try { obj = JSON.parse(content); } catch { return fallback(); }
    const res = AskResultSchema.safeParse(obj);
    if (!res.success || Object.keys(res.data).length === 0) return fallback();
    const query = resultToQueryString(res.data);
    if (!query) return fallback();
    return NextResponse.json({ ok: true, query });
  } catch {
    return fallback();
  } finally {
    clearTimeout(timer);
  }
}
