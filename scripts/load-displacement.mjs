// Load demolition permits as a displacement signal.
// Philadelphia doesn't publish eviction filings as open data, so this is
// the most direct proxy we have for housing stock loss. The UI labels
// the layer accurately as "demolition permits", not "evictions".
//
//   node scripts/load-displacement.mjs

import { pool } from "./_lib.mjs";

const CARTO = "https://phl.carto.com/api/v2/sql";

const SQL = `
  SELECT permitnumber, permitdescription, typeofwork, address, permitissuedate,
         ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat
    FROM permits
   WHERE permittype = 'Demolition'
     AND permitissuedate >= NOW() - INTERVAL '3 years'
     AND the_geom IS NOT NULL
   ORDER BY permitissuedate DESC
   LIMIT 5000
`;

const PHL_BBOX = { minLat: 39.85, maxLat: 40.15, minLng: -75.30, maxLng: -74.95 };

async function main() {
  console.log("fetching demolition permits...");
  const resp = await fetch(`${CARTO}?q=${encodeURIComponent(SQL)}`);
  if (!resp.ok) throw new Error(`carto ${resp.status}`);
  const json = await resp.json();
  const rows = json.rows ?? [];
  console.log(`got ${rows.length} rows`);

  const client = await pool.connect();
  let n = 0;
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE civic.displacement_signals RESTART IDENTITY");
    for (const r of rows) {
      const lat = Number(r.lat), lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < PHL_BBOX.minLat || lat > PHL_BBOX.maxLat) continue;
      if (lng < PHL_BBOX.minLng || lng > PHL_BBOX.maxLng) continue;
      await client.query(
        `INSERT INTO civic.displacement_signals
           (source, external_id, event_date, address, description, geom)
         VALUES ('demolition_permit', $1, $2, $3, $4,
                 ST_SetSRID(ST_MakePoint($5,$6),4326)::geography)
         ON CONFLICT (source, external_id) DO NOTHING`,
        [r.permitnumber, r.permitissuedate.slice(0, 10), r.address,
         r.permitdescription || r.typeofwork, lng, lat],
      );
      n++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  console.log(`done. ${n} signals loaded.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
