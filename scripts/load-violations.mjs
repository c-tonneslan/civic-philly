// Load L&I housing-code violations as a denser displacement signal than
// demolition permits. We grab open + recent violations from the city's
// Carto SQL API and clip to Philly bounds.
//
//   node scripts/load-violations.mjs

import { pool } from "./_lib.mjs";

const CARTO = "https://phl.carto.com/api/v2/sql";

// Most-recent residential / housing-code violations only.
const SQL = `
  SELECT casenumber, violationnumber, violationdate, address,
         violationcodetitle, casestatus,
         ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat
    FROM violations
   WHERE violationdate >= NOW() - INTERVAL '1 year'
     AND the_geom IS NOT NULL
     AND casetype = 'NOTICE OF VIOLATION'
   ORDER BY violationdate DESC
   LIMIT 5000
`;

const PHL_BBOX = { minLat: 39.85, maxLat: 40.15, minLng: -75.30, maxLng: -74.95 };

async function main() {
  console.log("fetching L&I violations...");
  const resp = await fetch(`${CARTO}?q=${encodeURIComponent(SQL)}`);
  if (!resp.ok) throw new Error(`carto ${resp.status}`);
  const json = await resp.json();
  const rows = json.rows ?? [];
  console.log(`got ${rows.length} rows`);

  // Don't wipe the table on an empty pull (Carto hiccup) and "succeed" with 0.
  if (rows.length === 0) {
    console.error("refusing to truncate: source returned 0 rows");
    await pool.end();
    process.exitCode = 1;
    return;
  }

  const client = await pool.connect();
  let n = 0;
  let failed = 0;
  try {
    await client.query("BEGIN");
    await client.query("TRUNCATE civic.violations RESTART IDENTITY");
    for (const r of rows) {
      const lat = Number(r.lat), lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < PHL_BBOX.minLat || lat > PHL_BBOX.maxLat) continue;
      if (lng < PHL_BBOX.minLng || lng > PHL_BBOX.maxLng) continue;
      const date = r.violationdate ? r.violationdate.slice(0, 10) : null;
      if (!date) continue;
      if (r.violationnumber == null) continue; // NOT NULL external_id / conflict key
      // SAVEPOINT per row so one constraint failure doesn't abort the whole
      // transaction (which would make COMMIT roll back and report a false success).
      await client.query("SAVEPOINT row");
      try {
        await client.query(
          `INSERT INTO civic.violations
             (external_id, case_number, violation_date, address, violation_type, status, geom)
           VALUES ($1,$2,$3,$4,$5,$6, ST_SetSRID(ST_MakePoint($7,$8),4326)::geography)
           ON CONFLICT (external_id) DO NOTHING`,
          [r.violationnumber, r.casenumber, date, r.address, r.violationcodetitle, r.casestatus, lng, lat],
        );
        await client.query("RELEASE SAVEPOINT row");
        n++;
      } catch (e) {
        await client.query("ROLLBACK TO SAVEPOINT row");
        failed++;
        if (failed <= 5) console.error("row failed:", e.message);
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  console.log(`done. ${n} violations loaded${failed ? `, ${failed} rows failed` : ""}.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
