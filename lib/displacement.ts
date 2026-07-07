import { query } from "./db";
import type { TractChoroplethRow } from "./context";

// Choropleth rows for the "Displacement pressure" overlay. Same shape/simplify
// pattern as getTractsForChoropleth; the score lives in the materialized view
// civic.tract_displacement_index (see db/schema_v6.sql) and geometry is joined
// back from census_tracts. dpi is cast ::float8 and re-coerced so MapLibre's
// interpolate expression never receives a string.
export async function getDpiChoropleth(): Promise<TractChoroplethRow[]> {
  const r = await query<TractChoroplethRow>(
    `SELECT d.geoid,
            d.dpi::float8 AS value,
            ST_AsGeoJSON(ST_SimplifyPreserveTopology(t.geom::geometry, 0.0002), 6) AS geom_geojson
       FROM civic.tract_displacement_index d
       JOIN civic.census_tracts t ON t.geoid = d.geoid`,
  );
  return r.rows.map((row) => ({ ...row, value: row.value == null ? null : Number(row.value) }));
}

export interface DpiRankRow {
  geoid: string;
  dpi: number;
  n_viol: number;
  n_demo: number;
  n_flip: number;
  pr_viol: number;
  pr_demo: number;
  pr_flip: number;
  pr_burden: number | null;
  pct_rent_burdened: number | null;
  centroid_lng: number;
  centroid_lat: number;
}

// Ranked hotspots for /displacement — raw counts kept alongside the percentiles
// so low-event tracts (whose DPI is carried by rent burden) are visible as such.
export async function getDpiRanked(limit = 60): Promise<DpiRankRow[]> {
  const r = await query<Record<string, unknown>>(
    `SELECT geoid, dpi::float8 AS dpi,
            n_viol, n_demo, n_flip,
            pr_viol::float8 AS pr_viol, pr_demo::float8 AS pr_demo,
            pr_flip::float8 AS pr_flip, pr_burden::float8 AS pr_burden,
            pct_rent_burdened::float8 AS pct_rent_burdened,
            centroid_lng::float8 AS centroid_lng, centroid_lat::float8 AS centroid_lat
       FROM civic.tract_displacement_index
      ORDER BY dpi DESC
      LIMIT $1`,
    [limit],
  );
  const num = (v: unknown): number => Number(v ?? 0);
  const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
  return r.rows.map((row) => ({
    geoid: String(row.geoid),
    dpi: num(row.dpi),
    n_viol: num(row.n_viol),
    n_demo: num(row.n_demo),
    n_flip: num(row.n_flip),
    pr_viol: num(row.pr_viol),
    pr_demo: num(row.pr_demo),
    pr_flip: num(row.pr_flip),
    pr_burden: numOrNull(row.pr_burden),
    pct_rent_burdened: numOrNull(row.pct_rent_burdened),
    centroid_lng: num(row.centroid_lng),
    centroid_lat: num(row.centroid_lat),
  }));
}
