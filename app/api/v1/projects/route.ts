import { NextResponse } from "next/server";
import { listProjects } from "@/lib/projects";
import { parseFiltersFromSearchParams } from "@/lib/filterParams";

// Public read-only JSON API.
// Same query params as the home page: type, status, district, neighborhood,
// funding, developer, startYear, endYear, q, lat/lng/radius for near-me.
// Returns up to 500 rows per call. Caches for 5 minutes at the edge.

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const filters = parseFiltersFromSearchParams(url.searchParams);
  // Clamp to non-negative — a negative LIMIT/OFFSET is a Postgres error (500).
  const limit = Math.min(Math.max(parseInt(url.searchParams.get("limit") || "100", 10) || 100, 1), 500);
  const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

  const rows = await listProjects(filters, limit, offset);

  return NextResponse.json(
    {
      count: rows.length,
      next: rows.length === limit ? offset + limit : null,
      projects: rows,
    },
    {
      headers: {
        "cache-control": "public, max-age=60, s-maxage=300",
        "access-control-allow-origin": "*",
      },
    },
  );
}
