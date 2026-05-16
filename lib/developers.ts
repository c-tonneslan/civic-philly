import { query } from "./db";

export interface DeveloperSummary {
  developer: string;
  total: number;
  housing: number;
  zoning: number;
  active: number;
  pipeline: number;
  completed: number;
  units_total: number | null;
  districts: number[];
}

export async function listTopDevelopers(limit = 50): Promise<DeveloperSummary[]> {
  const r = await query<{
    developer: string;
    total: string;
    housing: string;
    zoning: string;
    active: string;
    pipeline: string;
    completed: string;
    units_total: string | null;
    districts: number[];
  }>(`
    SELECT developer,
           COUNT(*)::int                                                      AS total,
           COUNT(*) FILTER (WHERE project_type = 'housing')::int               AS housing,
           COUNT(*) FILTER (WHERE project_type = 'zoning')::int                AS zoning,
           COUNT(*) FILTER (WHERE status = 'under_construction')::int          AS active,
           COUNT(*) FILTER (WHERE status IN ('proposed','approved'))::int      AS pipeline,
           COUNT(*) FILTER (WHERE status = 'completed')::int                   AS completed,
           SUM(units_total) FILTER (WHERE project_type = 'housing')            AS units_total,
           ARRAY_AGG(DISTINCT council_district_id ORDER BY council_district_id)
             FILTER (WHERE council_district_id IS NOT NULL)                    AS districts
      FROM civic.projects
     WHERE developer IS NOT NULL
     GROUP BY developer
     ORDER BY total DESC
     LIMIT $1
  `, [limit]);

  return r.rows.map((row) => ({
    developer: row.developer,
    total: Number(row.total),
    housing: Number(row.housing),
    zoning: Number(row.zoning),
    active: Number(row.active),
    pipeline: Number(row.pipeline),
    completed: Number(row.completed),
    units_total: row.units_total != null ? Number(row.units_total) : null,
    districts: row.districts ?? [],
  }));
}

export async function getDeveloper(name: string): Promise<DeveloperSummary | null> {
  const r = await query<DeveloperSummary>(`
    SELECT developer,
           COUNT(*)::int                                                      AS total,
           COUNT(*) FILTER (WHERE project_type = 'housing')::int               AS housing,
           COUNT(*) FILTER (WHERE project_type = 'zoning')::int                AS zoning,
           COUNT(*) FILTER (WHERE status = 'under_construction')::int          AS active,
           COUNT(*) FILTER (WHERE status IN ('proposed','approved'))::int      AS pipeline,
           COUNT(*) FILTER (WHERE status = 'completed')::int                   AS completed,
           SUM(units_total) FILTER (WHERE project_type = 'housing')::int       AS units_total,
           COALESCE(ARRAY_AGG(DISTINCT council_district_id ORDER BY council_district_id)
             FILTER (WHERE council_district_id IS NOT NULL), '{}')             AS districts
      FROM civic.projects
     WHERE developer = $1
     GROUP BY developer
  `, [name]);
  return r.rows[0] ?? null;
}
