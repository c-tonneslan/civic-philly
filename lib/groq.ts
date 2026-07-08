// Thin Groq (OpenAI-compatible) client for the NL "ask the map" feature.
// Mirrors lib/email.ts's graceful degradation: no key -> feature disabled, never
// a crash. Model id pinned in one place (Groq deprecates ids periodically).
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODEL = "llama-3.3-70b-versatile";

export function getGroqKey(): string | null {
  return process.env.GROQ_API_KEY || null;
}

// A delay that rejects as soon as the signal aborts, so a retry backoff can't
// outlive the caller's timeout.
function abortableDelay(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); }, { once: true });
  });
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
    if (opts.signal?.aborted) throw new Error("aborted");
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

    // Retry transient rate-limit / unavailability. Cap the wait (a rate-limited
    // Groq can send Retry-After: 3600, which would otherwise block the request
    // far past the caller's timeout budget) and make the sleep abortable so the
    // 5s AbortController in the route actually cancels it.
    if ((resp.status === 429 || resp.status === 503) && attempt < maxAttempts) {
      const ra = Number(resp.headers.get("retry-after"));
      const raw = Number.isFinite(ra) && ra > 0 ? ra * 1000 : 2 ** attempt * 250 + Math.random() * 200;
      const wait = Math.min(raw, 2000);
      await abortableDelay(wait, opts.signal);
      continue;
    }
    throw new Error(`groq ${resp.status}`);
  }
  throw new Error("groq: retries exhausted");
}
