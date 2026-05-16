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
       SELECT observed_at FROM civic.status_history
        WHERE project_id = p.id AND status = p.status
        ORDER BY observed_at ASC LIMIT 1
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
    `SELECT geoid, ${col} AS value, ST_AsGeoJSON(geom::geometry) AS geom_geojson
       FROM civic.census_tracts
       WHERE ${col} IS NOT NULL`,
  );
  return r.rows;
}
