import { query } from "./db";

export interface WeekHeadline {
  total_new: number;
  per_district: { district_id: number; n: number }[];
  top_developers: { developer: string; n: number }[];
  big_projects: {
    id: number; name: string; project_type: string; status: string;
    funding_amount: number | null; units_total: number | null;
    council_district_id: number | null;
  }[];
  status_changes: number;
  new_demolitions: number;
  new_violations: number;
  stalled_count: number;
}

// Aggregate "what happened this week" across the dataset. Powers the
// content homepage (/this-week) and the public RSS feeds.
export async function getWeekHeadlines(days = 7): Promise<WeekHeadline> {
  const sinceIso = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString();

  const [totalRes, perDistrictRes, devRes, bigRes, statusRes, demoRes, violRes, stalledRes] = await Promise.all([
    query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM civic.projects WHERE first_seen_at > $1`, [sinceIso]),
    query<{ district_id: number; n: string }>(
      `SELECT council_district_id AS district_id, COUNT(*)::text n
         FROM civic.projects
        WHERE first_seen_at > $1 AND council_district_id IS NOT NULL
        GROUP BY council_district_id ORDER BY n DESC`, [sinceIso]),
    query<{ developer: string; n: string }>(
      `SELECT developer, COUNT(*)::text n
         FROM civic.projects
        WHERE first_seen_at > $1 AND developer IS NOT NULL
        GROUP BY developer ORDER BY n DESC LIMIT 10`, [sinceIso]),
    query<{
      id: string; name: string; project_type: string; status: string;
      funding_amount: string | null; units_total: number | null;
      council_district_id: number | null;
    }>(
      `SELECT id::text, name, project_type, status, funding_amount, units_total, council_district_id
         FROM civic.projects
        WHERE first_seen_at > $1
        ORDER BY
          CASE WHEN project_type IN ('transit','infrastructure') THEN 0 ELSE 1 END,
          COALESCE(funding_amount, 0) DESC,
          COALESCE(units_total, 0) DESC
        LIMIT 10`, [sinceIso]),
    query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM civic.status_history WHERE observed_at > $1`, [sinceIso]),
    query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM civic.displacement_signals WHERE event_date > $1`, [sinceIso]),
    query<{ n: string }>(
      `SELECT COUNT(*)::text n FROM civic.violations WHERE violation_date > $1`, [sinceIso]),
    query<{ n: string }>(`
      SELECT COUNT(*)::text n FROM (
        SELECT p.id, h.observed_at
          FROM civic.projects p
          JOIN LATERAL (
            SELECT observed_at FROM civic.status_history
             WHERE project_id = p.id AND status = p.status
             ORDER BY observed_at ASC LIMIT 1
          ) h ON TRUE
         WHERE p.status IN ('proposed','approved')
           AND h.observed_at < NOW() - INTERVAL '365 days'
      ) x
    `),
  ]);

  return {
    total_new: Number(totalRes.rows[0].n),
    per_district: perDistrictRes.rows.map((r) => ({ district_id: r.district_id, n: Number(r.n) })),
    top_developers: devRes.rows.map((r) => ({ developer: r.developer, n: Number(r.n) })),
    big_projects: bigRes.rows.map((r) => ({
      id: Number(r.id),
      name: r.name, project_type: r.project_type, status: r.status,
      funding_amount: r.funding_amount != null ? Number(r.funding_amount) : null,
      units_total: r.units_total,
      council_district_id: r.council_district_id,
    })),
    status_changes: Number(statusRes.rows[0].n),
    new_demolitions: Number(demoRes.rows[0].n),
    new_violations: Number(violRes.rows[0].n),
    stalled_count: Number(stalledRes.rows[0].n),
  };
}
