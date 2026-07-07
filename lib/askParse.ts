import { z } from "zod";
import { PROJECT_TYPES, PROJECT_STATUSES } from "./types";
import type { ProjectFilters } from "./types";
import { parseFiltersFromSearchParams } from "./filterParams";
import { buildQuery } from "./queryString";

// The LLM returns an object whose keys EXACTLY match ProjectFilters (so buildQuery
// maps them to the right URL keys). All optional; unknown keys (e.g. a stray
// `developer`) are stripped by z.object's default behavior. `near`/radius is
// intentionally not accepted — it needs a geocoder and isn't NL-parseable here.
export const AskResultSchema = z.object({
  types: z.array(z.enum(PROJECT_TYPES as [string, ...string[]])).optional(),
  statuses: z.array(z.enum(PROJECT_STATUSES as [string, ...string[]])).optional(),
  neighborhood: z.string().min(1).max(120).optional(),
  fundingSource: z.string().min(1).max(120).optional(),
  districtId: z.number().int().min(1).max(10).optional(),
  q: z.string().min(1).max(300).optional(),
  startYear: z.number().int().min(1900).max(2100).optional(),
  endYear: z.number().int().min(1900).max(2100).optional(),
});

export function buildSystemPrompt(neighborhoods: string[], today: string): string {
  return `You translate a user's plain-English question about Philadelphia real-estate development into a JSON filter object. Respond with ONLY a json object and no prose.

Fields (all optional — omit any you cannot fill):
- types: array of any of [${PROJECT_TYPES.join(", ")}]
- statuses: array of any of [${PROJECT_STATUSES.filter((s) => s !== "unknown").join(", ")}]
- neighborhood: string — ONLY if it exactly matches one of the known neighborhoods listed below; otherwise fold the location words into q
- fundingSource: string
- districtId: integer 1–10 — only if the user explicitly names a City Council district number; never invent one
- startYear, endYear: 4-digit integer years
- q: free-text for anything the fields above don't capture (developer/company names, street names, keywords)

Rules:
- Today is ${today}. Resolve relative time to years: "since 2020" -> startYear 2020; "in 2022" -> startYear 2022 and endYear 2022; "in the last N years" -> startYear (this year minus N).
- NEVER output a developer field — put developer or company names into q (full-text search already indexes developer).
- "stalled", "this week", and property "transfers"/"sales" are separate pages, not filters — fold those words into q or omit them.
- "near me" / "within X miles" / radius is unsupported — omit it.
- If nothing is extractable, return {}.

Known neighborhoods: ${neighborhoods.join(", ")}`;
}

// Turn the validated result into a clean, re-clamped query string. Serializing
// through buildQuery -> parseFiltersFromSearchParams -> buildQuery applies the
// exact same guards a hand-typed URL gets, and maps districtId->district etc.
export function resultToQueryString(result: z.infer<typeof AskResultSchema>): string {
  const first = buildQuery(result as ProjectFilters);
  const reparsed = parseFiltersFromSearchParams(new URLSearchParams(first.replace(/^\?/, "")));
  return buildQuery(reparsed);
}
