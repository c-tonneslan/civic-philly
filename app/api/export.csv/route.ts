import { listProjects } from "@/lib/projects";
import { parseFiltersFromSearchParams } from "@/lib/filterParams";

const COLS = [
  "id", "project_type", "status", "name", "address", "neighborhood",
  "council_district_id", "census_tract_geoid", "zip_code",
  "funding_source", "funding_amount",
  "units_total", "units_affordable",
  "start_date", "completion_date", "approved_date",
  "lat", "lng", "source_url", "datasource_id", "first_seen_at",
] as const;

function csvEscape(v: unknown): string {
  if (v == null) return "";
  let s = String(v);
  // Formula-injection guard: a spreadsheet treats a cell starting with = + - @
  // (or a leading tab/CR) as a formula. Prefix a single quote to neutralise it
  // before the CSV quoting below. Values here are civic data, but source_url /
  // name are free-text and could carry a crafted payload.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (s.includes(",") || s.includes("\"") || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filters = parseFiltersFromSearchParams(url.searchParams);
  // Hard cap so a wide-open query doesn't time out the function.
  const rows = await listProjects(filters, 10_000, 0);

  const header = COLS.join(",");
  const body = rows.map((r) =>
    COLS.map((c) => csvEscape((r as unknown as Record<string, unknown>)[c])).join(","),
  ).join("\n");
  const csv = header + "\n" + body + "\n";

  const filename = `civic-philly-export-${new Date().toISOString().slice(0,10)}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
