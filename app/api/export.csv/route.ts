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
  const s = String(v);
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
