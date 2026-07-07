import { query } from "./db";

// Delivery / accountability scorecard: for projects grouped by VINTAGE (the year
// first proposed/approved), what share reached construction vs stalled vs was
// cancelled. District scope comes from a WHERE filter — the grouping is ALWAYS by
// vintage only, so getDeliveryCohorts(id) and getCitywideCohorts() return the
// same shape (one row per vintage).

// A tract of vintages younger than this hasn't had time to deliver — never show
// a delivery rate for them (survivorship/censoring guard).
export const MATURITY_YEARS = 3;
export function currentYear(): number {
  return new Date().getFullYear();
}
export function isMatureVintage(vintage: number): boolean {
  return vintage <= currentYear() - MATURITY_YEARS;
}

export interface CohortRow {
  vintage: number;
  n: number;
  completed: number;
  in_progress: number;   // under_construction
  pipeline_total: number; // proposed + approved (before splitting out stalled)
  cancelled: number;
  unknown: number;
  vintage_approx_n: number; // vintage inferred from first_seen_at (no approved/start date)
  stalled: number;        // subset of pipeline_total, filled from status history
  active_pipeline: number; // pipeline_total - stalled, clamped >= 0
}

interface RawCohort {
  vintage: number;
  n: number;
  completed: number;
  in_progress: number;
  pipeline_total: number;
  cancelled: number;
  unknown: number;
  vintage_approx_n: number;
}

export async function getDeliveryCohorts(districtId?: number): Promise<CohortRow[]> {
  const did = districtId ?? null;

  const cohorts = await query<RawCohort>(
    `SELECT vintage,
            COUNT(*)::int AS n,
            COUNT(*) FILTER (WHERE status = 'completed')::int AS completed,
            COUNT(*) FILTER (WHERE status = 'under_construction')::int AS in_progress,
            COUNT(*) FILTER (WHERE status IN ('proposed', 'approved'))::int AS pipeline_total,
            COUNT(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
            COUNT(*) FILTER (WHERE status = 'unknown' OR status IS NULL)::int AS unknown,
            COUNT(*) FILTER (WHERE approved_date IS NULL AND start_date IS NULL)::int AS vintage_approx_n
       FROM (
         SELECT status, approved_date, start_date,
                EXTRACT(YEAR FROM COALESCE(approved_date, start_date, first_seen_at))::int AS vintage
           FROM civic.projects
          WHERE COALESCE(approved_date, start_date, first_seen_at) IS NOT NULL
            AND ($1::int IS NULL OR council_district_id = $1)
       ) s
      WHERE vintage BETWEEN 2015 AND EXTRACT(YEAR FROM NOW())::int
      GROUP BY vintage
      ORDER BY vintage`,
    [did],
  );

  // Stalled = proposed/approved anchored to the current continuous status run,
  // over a year old — the same definition as getStalledProjects.
  const stalledRows = await query<{ vintage: number; stalled: number }>(
    `SELECT EXTRACT(YEAR FROM COALESCE(p.approved_date, p.start_date, p.first_seen_at))::int AS vintage,
            COUNT(*)::int AS stalled
       FROM civic.projects p
       JOIN LATERAL (
         SELECT MIN(sh.observed_at) AS observed_at
           FROM civic.status_history sh
          WHERE sh.project_id = p.id
            AND sh.status = p.status
            AND sh.observed_at > COALESCE(
              (SELECT MAX(x.observed_at) FROM civic.status_history x
                WHERE x.project_id = p.id AND x.status <> p.status),
              '-infinity'::timestamptz)
       ) h ON TRUE
      WHERE p.status IN ('proposed', 'approved')
        AND h.observed_at < NOW() - INTERVAL '365 days'
        AND ($1::int IS NULL OR p.council_district_id = $1)
        AND EXTRACT(YEAR FROM COALESCE(p.approved_date, p.start_date, p.first_seen_at)) BETWEEN 2015 AND EXTRACT(YEAR FROM NOW())
      GROUP BY vintage`,
    [did],
  );
  const stalledByVintage = new Map(stalledRows.rows.map((r) => [Number(r.vintage), Number(r.stalled)]));

  return cohorts.rows.map((r) => {
    const stalled = Math.min(stalledByVintage.get(Number(r.vintage)) ?? 0, r.pipeline_total);
    return {
      vintage: Number(r.vintage),
      n: r.n,
      completed: r.completed,
      in_progress: r.in_progress,
      pipeline_total: r.pipeline_total,
      cancelled: r.cancelled,
      unknown: r.unknown,
      vintage_approx_n: r.vintage_approx_n,
      stalled,
      active_pipeline: Math.max(0, r.pipeline_total - stalled),
    };
  });
}

export function getCitywideCohorts(): Promise<CohortRow[]> {
  return getDeliveryCohorts();
}
