import { query } from "./db";
import type { Project, ProjectFilters } from "./types";

function buildFilterClause(filters: ProjectFilters, params: unknown[]): string {
  const where: string[] = [];

  if (filters.types?.length) {
    params.push(filters.types);
    where.push(`project_type = ANY($${params.length})`);
  }
  if (filters.statuses?.length) {
    params.push(filters.statuses);
    where.push(`status = ANY($${params.length})`);
  }
  if (filters.neighborhood) {
    params.push(filters.neighborhood);
    where.push(`neighborhood ILIKE $${params.length}`);
  }
  if (filters.fundingSource) {
    params.push(`%${filters.fundingSource}%`);
    where.push(`funding_source ILIKE $${params.length}`);
  }
  if (filters.districtId) {
    params.push(filters.districtId);
    where.push(`council_district_id = $${params.length}`);
  }
  if (filters.developer) {
    params.push(filters.developer);
    where.push(`developer = $${params.length}`);
  }
  if (filters.q) {
    params.push(filters.q);
    // websearch_to_tsquery is the user-friendly variant: handles
    // multi-word queries, OR/AND, exact phrases in quotes. tsv is
    // a STORED generated column so this hits the GIN index.
    where.push(`tsv @@ websearch_to_tsquery('english', $${params.length})`);
  }
  if (filters.startYear) {
    params.push(`${filters.startYear}-01-01`);
    where.push(`(start_date >= $${params.length} OR approved_date >= $${params.length} OR first_seen_at >= $${params.length})`);
  }
  if (filters.endYear) {
    params.push(`${filters.endYear}-12-31`);
    where.push(`(completion_date <= $${params.length} OR (completion_date IS NULL AND start_date <= $${params.length}))`);
  }
  if (filters.near) {
    params.push(filters.near.lng, filters.near.lat, filters.near.radiusMeters);
    const n = params.length;
    where.push(
      `ST_DWithin(geom, ST_SetSRID(ST_MakePoint($${n - 2}, $${n - 1}), 4326)::geography, $${n})`,
    );
  }

  return where.length ? `WHERE ${where.join(" AND ")}` : "";
}

// Map-friendly projection: just enough to render points and a popup card.
export interface MapProject {
  id: number;
  project_type: Project["project_type"];
  status: Project["status"];
  name: string;
  lat: number;
  lng: number;
}

export async function listMapProjects(filters: ProjectFilters): Promise<MapProject[]> {
  const params: unknown[] = [];
  const whereSql = buildFilterClause(filters, params);
  const sql = `
    SELECT id, project_type, status, name,
           ST_Y(geom::geometry) AS lat,
           ST_X(geom::geometry) AS lng
    FROM civic.projects
    ${whereSql}
    LIMIT 5000
  `;
  const r = await query<MapProject>(sql, params);
  return r.rows;
}

export async function listProjects(filters: ProjectFilters, limit = 50, offset = 0) {
  const params: unknown[] = [];
  const whereSql = buildFilterClause(filters, params);
  params.push(limit, offset);
  const sql = `
    SELECT
      id, datasource_id, external_id, project_type, name, description, address,
      neighborhood, council_district, zip_code, status, funding_source, funding_amount,
      units_total, units_affordable, start_date, completion_date, approved_date,
      source_url, first_seen_at, council_district_id, census_tract_geoid,
      rco_id, developer,
      ST_Y(geom::geometry) AS lat,
      ST_X(geom::geometry) AS lng
    FROM civic.projects
    ${whereSql}
    ORDER BY
      CASE WHEN status = 'under_construction' THEN 0
           WHEN status = 'approved' THEN 1
           WHEN status = 'proposed' THEN 2
           ELSE 3 END,
      COALESCE(start_date, approved_date, first_seen_at) DESC NULLS LAST
    LIMIT $${params.length - 1} OFFSET $${params.length}
  `;
  const r = await query<Project>(sql, params);
  return r.rows;
}

export async function getProject(id: number): Promise<Project | null> {
  const r = await query<Project>(
    `SELECT
       id, datasource_id, external_id, project_type, name, description, address,
       neighborhood, council_district, zip_code, status, funding_source, funding_amount,
       units_total, units_affordable, start_date, completion_date, approved_date,
       source_url, first_seen_at, council_district_id, census_tract_geoid,
       rco_id, developer,
       ST_Y(geom::geometry) AS lat,
       ST_X(geom::geometry) AS lng
     FROM civic.projects WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

export async function listNeighborhoods(): Promise<string[]> {
  const r = await query<{ neighborhood: string }>(
    `SELECT DISTINCT neighborhood
     FROM civic.projects
     WHERE neighborhood IS NOT NULL AND neighborhood <> ''
     ORDER BY neighborhood`,
  );
  return r.rows.map((x) => x.neighborhood);
}

export async function listFundingSources(): Promise<string[]> {
  const r = await query<{ funding_source: string }>(
    `SELECT DISTINCT funding_source
     FROM civic.projects
     WHERE funding_source IS NOT NULL AND funding_source <> ''
     ORDER BY funding_source`,
  );
  return r.rows.map((x) => x.funding_source);
}
