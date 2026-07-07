// Shared helpers for scrapers.

import { config as loadDotenv } from "dotenv";
import pg from "pg";

loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("error: DATABASE_URL is not set.");
  process.exit(1);
}

const { Pool } = pg;
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /supabase|neon/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
  options: "-c search_path=civic,extensions,public",
});

// Paginate an ArcGIS FeatureServer query endpoint until exhausted.
export async function fetchArcgisAll(endpoint, extraParams = {}) {
  const out = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      where: "1=1",
      outFields: "*",
      outSR: "4326",
      returnGeometry: "true",
      f: "json",
      resultOffset: String(offset),
      resultRecordCount: "2000",
      ...extraParams,
    });
    const resp = await fetch(`${endpoint}?${params}`);
    if (!resp.ok) throw new Error(`arcgis ${resp.status}: ${resp.statusText}`);
    const json = await resp.json();
    const feats = json.features ?? [];
    out.push(...feats);
    if (!json.exceededTransferLimit || feats.length === 0) break;
    offset += feats.length;
  }
  return out;
}

export function pointFromFeature(feat) {
  const g = feat.geometry || {};
  // FeatureServer returns either {x,y} for points or {rings: [...]} for polygons.
  if (Number.isFinite(g.x) && Number.isFinite(g.y)) return { lng: g.x, lat: g.y };
  if (Array.isArray(g.rings) && g.rings[0]?.length) {
    // crude centroid: average the ring's vertices.
    const ring = g.rings[0];
    let sx = 0, sy = 0;
    for (const [x, y] of ring) { sx += x; sy += y; }
    return { lng: sx / ring.length, lat: sy / ring.length };
  }
  return null;
}

const UPSERT_SQL = `
INSERT INTO civic.projects (
  datasource_id, external_id, project_type, name, description, address,
  neighborhood, council_district, zip_code, status, funding_source,
  funding_amount, units_total, units_affordable,
  start_date, completion_date, approved_date, source_url, raw_attrs, geom,
  opa_account
) VALUES (
  $1,$2,$3,$4,$5,$6,
  $7,$8,$9,$10,$11,
  $12,$13,$14,
  $15,$16,$17,$18,$19,
  ST_SetSRID(ST_MakePoint($20,$21),4326)::geography,
  $22
)
ON CONFLICT (datasource_id, external_id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  address = EXCLUDED.address,
  neighborhood = EXCLUDED.neighborhood,
  status = EXCLUDED.status,
  funding_source = EXCLUDED.funding_source,
  funding_amount = EXCLUDED.funding_amount,
  units_total = EXCLUDED.units_total,
  units_affordable = EXCLUDED.units_affordable,
  start_date = EXCLUDED.start_date,
  completion_date = EXCLUDED.completion_date,
  approved_date = EXCLUDED.approved_date,
  source_url = EXCLUDED.source_url,
  raw_attrs = EXCLUDED.raw_attrs,
  geom = EXCLUDED.geom,
  opa_account = COALESCE(EXCLUDED.opa_account, civic.projects.opa_account),
  imported_at = NOW()
RETURNING id, (xmax = 0) AS inserted, status;
`;

export async function upsertProjects(datasourceId, projects) {
  const client = await pool.connect();
  let inserted = 0;
  let updated = 0;
  try {
    await client.query("BEGIN");
    for (const p of projects) {
      const r = await client.query(UPSERT_SQL, [
        datasourceId,
        p.external_id,
        p.project_type,
        p.name,
        p.description ?? null,
        p.address ?? null,
        p.neighborhood ?? null,
        p.council_district ?? null,
        p.zip_code ?? null,
        p.status ?? "unknown",
        p.funding_source ?? null,
        p.funding_amount ?? null,
        p.units_total ?? null,
        p.units_affordable ?? null,
        p.start_date ?? null,
        p.completion_date ?? null,
        p.approved_date ?? null,
        p.source_url ?? null,
        p.raw_attrs ? JSON.stringify(p.raw_attrs) : null,
        p.lng,
        p.lat,
        p.opa_account ?? null,
      ]);
      const row = r.rows[0];
      if (row?.inserted) inserted++; else updated++;
      // Capture a status snapshot if the status changed (or it's the first
      // sighting). This is what powers the "stalled projects" view and
      // promises-vs-delivery accountability tracker.
      if (row) {
        const prev = await client.query(
          `SELECT status FROM civic.status_history
             WHERE project_id = $1
             ORDER BY observed_at DESC LIMIT 1`,
          [row.id],
        );
        if (!prev.rows[0] || prev.rows[0].status !== row.status) {
          await client.query(
            "INSERT INTO civic.status_history (project_id, status) VALUES ($1, $2)",
            [row.id, row.status],
          );
        }
      }
    }
    await client.query(
      "UPDATE civic.datasources SET last_fetched_at = NOW(), record_count = $2, status = 'ok' WHERE id = $1",
      [datasourceId, projects.length],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    await pool.query("UPDATE civic.datasources SET status = 'degraded' WHERE id = $1", [datasourceId]).catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  return { inserted, updated };
}

export function asInt(v) {
  if (v == null) return null;
  const n = parseInt(String(v).replace(/[^\d-]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

export function asNumber(v) {
  if (v == null) return null;
  const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function asDate(v) {
  if (!v) return null;
  if (typeof v === "number") {
    // A small integer is a year (e.g. fiscal_year_complete = 2019), not epoch
    // millis — new Date(2019) would be 1970-01-01. Epoch-millis timestamps are ~1e12.
    if (v >= 1900 && v <= 2100) return `${v}-01-01`;
    if (v > 1e11) return new Date(v).toISOString().slice(0, 10);
    return null;
  }
  if (typeof v === "string") {
    if (/^\d{4}$/.test(v)) return `${v}-01-01`;
    const d = new Date(v);
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return null;
}
