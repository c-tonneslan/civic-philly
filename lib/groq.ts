// Thin Groq (OpenAI-compatible) client for the NL "ask the map" feature.
// Mirrors lib/email.ts's graceful degradation: no key -> feature disabled, never
// a crash. Model id pinned in one place (Groq deprecates ids periodically).
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export function getGroqKey(): string | null {
  return process.env.GROQ_API_KEY || null;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

// Returns the assistant message content (a JSON string, given json response mode).
// Throws on a non-retryable failure or exhausted retries so the caller can fall
// back to plain search.
export async function groqChat(messages: ChatMessage[], opts: { signal?: AbortSignal } = {}): Promise<string> {
  const key = getGroqKey();
  if (!key) throw new Error("GROQ_API_KEY not set");

  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const resp = await fetch(GROQ_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0,
        response_format: { type: "json_object" },
        messages,
      }),
      signal: opts.signal,
    });

    if (resp.ok) {
      const j = await resp.json();
      return j.choices?.[0]?.message?.content ?? "";
    }

    // Retry transient rate-limit / unavailability, honoring Retry-After.
    if ((resp.status === 429 || resp.status === 503) && attempt < maxAttempts) {
      const ra = Number(resp.headers.get("retry-after"));
      const wait = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2 ** attempt * 250 + Math.random() * 200;
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    throw new Error(`groq ${resp.status}`);
  }
  throw new Error("groq: retries exhausted");
}
