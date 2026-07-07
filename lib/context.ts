import { query } from "./db";
import type {
  CensusTract, DistrictStats, ElectedOfficial, DisplacementSignal, Project,
} from "./types";

export async function getDistrictStats(): Promise<DistrictStats[]> {
  const r = await query<DistrictStats>(`SELECT * FROM civic.district_stats ORDER BY district_id`);
  return r.rows;
}

export async function getDistrict(id: number): Promise<DistrictStats | null> {
  const r = await query<DistrictStats>(
    `SELECT * FROM civic.district_stats WHERE district_id = $1`, [id],
  );
  return r.rows[0] ?? null;
}

export async function getDistrictOfficial(districtId: number): Promise<ElectedOfficial | null> {
  const r = await query<ElectedOfficial>(
    `SELECT id, role, district_id, name, party, email, phone, office_address, website, twitter
       FROM civic.elected_officials WHERE district_id = $1 LIMIT 1`,
    [districtId],
  );
  return r.rows[0] ?? null;
}

export async function getAtLargeCouncil(): Promise<ElectedOfficial[]> {
  const r = await query<ElectedOfficial>(
    `SELECT id, role, district_id, name, party, email, phone, office_address, website, twitter
       FROM civic.elected_officials WHERE role = 'council_at_large' ORDER BY name`,
  );
  return r.rows;
}

export interface RCO {
  id: number;
  name: string;
  primary_name: string | null;
  primary_email: string | null;
  primary_phone: string | null;
  website: string | null;
  meeting_info: string | null;
}

export async function getRCO(id: number): Promise<RCO | null> {
  const r = await query<RCO>(
    `SELECT id, name, primary_name, primary_email, primary_phone, website, meeting_info
       FROM civic.rcos WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}

// Year-by-year project counts for a district. Powers the chart on the
// district page. Uses approved_date / start_date / first_seen_at in that
// order of preference.
export interface YearBucket {
  year: number;
  housing: number;
  transit: number;
  zoning: number;
  infrastructure: number;
}

export async function getDistrictTimeSeries(districtId: number): Promise<YearBucket[]> {
  const r = await query<{ year: number; project_type: string; n: string }>(`
    SELECT year, project_type, COUNT(*)::text AS n
      FROM (
        SELECT EXTRACT(YEAR FROM COALESCE(approved_date, start_date, first_seen_at))::int AS year,
               project_type
          FROM civic.projects
         WHERE council_district_id = $1
           AND COALESCE(approved_date, start_date, first_seen_at) IS NOT NULL
      ) x
     WHERE year >= 2015
     GROUP BY year, project_type
     ORDER BY year ASC
  `, [districtId]);
  const buckets = new Map<number, YearBucket>();
  for (const row of r.rows) {
    if (!buckets.has(row.year)) {
      buckets.set(row.year, { year: row.year, housing: 0, transit: 0, zoning: 0, infrastructure: 0 });
    }
    const b = buckets.get(row.year)!;
    (b as unknown as Record<string, number>)[row.project_type] = Number(row.n);
  }
  return [...buckets.values()];
}

export async function getTract(geoid: string): Promise<CensusTract | null> {
  const r = await query<CensusTract>(
    `SELECT geoid, name, total_pop, median_hh_income, pct_rent_burdened, pct_renter,
            pct_white, pct_black, pct_hispanic, pct_asian, acs_year
       FROM civic.census_tracts WHERE geoid = $1`,
    [geoid],
  );
  return r.rows[0] ?? null;
}

// Projects within `meters` of (lng, lat), excluding `excludeId`.
export async function getSiblingProjects(
  lat: number, lng: number, meters = 400, excludeId?: number, limit = 10,
): Promise<Project[]> {
  const r = await query<Project>(
    `SELECT id, datasource_id, external_id, project_type, name, description, address,
            neighborhood, council_district, zip_code, status, funding_source, funding_amount,
            units_total, units_affordable, start_date, completion_date, approved_date,
            source_url, first_seen_at,
            ST_Y(geom::geometry) AS lat,
            ST_X(geom::geometry) AS lng
       FROM civic.projects
      WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
        AND ($4::bigint IS NULL OR id <> $4::bigint)
      ORDER BY geom <-> ST_SetSRID(ST_MakePoint($1,$2),4326)::geography
      LIMIT $5`,
    [lng, lat, meters, excludeId ?? null, limit],
  );
  return r.rows;
}

export async function getDisplacementWithin(
  lat: number, lng: number, meters = 400, sinceYears = 3, limit = 50,
): Promise<DisplacementSignal[]> {
  const since = new Date();
  since.setFullYear(since.getFullYear() - sinceYears);
  const r = await query<DisplacementSignal>(
    `SELECT id, source, event_date, address, description,
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM civic.displacement_signals
      WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
        AND event_date >= $4
      ORDER BY event_date DESC
      LIMIT $5`,
    [lng, lat, meters, since.toISOString().slice(0, 10), limit],
  );
  return r.rows;
}

export interface StatusEvent {
  status: string;
  observed_at: string;
}

export async function getStatusHistory(projectId: number): Promise<StatusEvent[]> {
  const r = await query<StatusEvent>(
    `SELECT status, observed_at FROM civic.status_history
      WHERE project_id = $1 ORDER BY observed_at ASC`,
    [projectId],
  );
  return r.rows;
}

export interface StalledProject {
  id: number;
  name: string;
  project_type: string;
  status: string;
  council_district_id: number | null;
  neighborhood: string | null;
  funding_amount: number | null;
  units_total: number | null;
  days_in_status: number;
}

// Projects that have been "approved" or "proposed" for more than `days`
// and never moved on. The credibility play: nobody else tracks this.
export async function getStalledProjects(days = 365, limit = 200): Promise<StalledProject[]> {
  const r = await query<StalledProject>(
    `SELECT
       p.id, p.name, p.project_type, p.status,
       p.council_district_id, p.neighborhood,
       p.funding_amount, p.units_total,
       FLOOR(EXTRACT(EPOCH FROM (NOW() - h.observed_at)) / 86400)::int AS days_in_status
     FROM civic.projects p
     JOIN LATERAL (
       -- Anchor to the CURRENT continuous run in this status, not the first time
       -- it was ever seen. A project that was approved, changed, then re-entered
       -- 'approved' should count from the latest entry — otherwise days_in_status
       -- is overstated. The run starts at the earliest snapshot in this status
       -- that comes after the last snapshot in any other status.
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
       AND h.observed_at < NOW() - ($1 || ' days')::interval
     ORDER BY h.observed_at ASC
     LIMIT $2`,
    [String(days), limit],
  );
  return r.rows;
}

export interface TractChoroplethRow {
  geoid: string;
  value: number | null;
  geom_geojson: string;
}

export async function getTractsForChoropleth(
  metric: "rent_burdened" | "renter" | "income" | "white" | "black" | "hispanic" | "asian",
): Promise<TractChoroplethRow[]> {
  const col = {
    rent_burdened: "pct_rent_burdened",
    renter: "pct_renter",
    income: "median_hh_income",
    white: "pct_white",
    black: "pct_black",
    hispanic: "pct_hispanic",
    asian: "pct_asian",
  }[metric];
  const r = await query<TractChoroplethRow>(
    // Cast NUMERIC columns to float8 so pg returns them as JS numbers.
    // Otherwise they come back as strings and the maplibre interpolate
    // expression errors with "Expected number but found string instead."
    // Simplify (~20m tolerance) and trim coordinates to 6 decimals before
    // shipping the choropleth. Full-resolution tract polygons are a large
    // payload for a fill layer that renders at city zoom anyway.
    `SELECT geoid, ${col}::float8 AS value,
            ST_AsGeoJSON(ST_SimplifyPreserveTopology(geom::geometry, 0.0002), 6) AS geom_geojson
       FROM civic.census_tracts
       WHERE ${col} IS NOT NULL`,
  );
  return r.rows;
}
