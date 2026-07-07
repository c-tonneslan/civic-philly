// Load Philadelphia real-estate transfers (deeds). Tracks who actually
// bought what. The journalism move: catch LLCs sweeping up blocks of
// houses or speculators flipping in displacement-prone neighborhoods.
//
// Source: city Carto SQL API, rtt_summary table.
//
//   node scripts/load-transfers.mjs

import { pool } from "./_lib.mjs";

const CARTO = "https://phl.carto.com/api/v2/sql";

// Only document types that actually transfer ownership. Skips mortgages,
// satisfactions, assignments, etc. Caps at $1+ consideration to drop
// nominal family transfers and easements.
const SQL = `
  SELECT document_id, document_type, display_date, street_address, zip_code,
         grantors, grantees, total_consideration, fair_market_value,
         ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat
    FROM rtt_summary
   WHERE document_type IN ('DEED','MISCELLANEOUS DEED','SHERIFF''S DEED')
     AND display_date >= NOW() - INTERVAL '18 months'
     AND the_geom IS NOT NULL
     AND total_consideration IS NOT NULL
     AND total_consideration > 1
   ORDER BY display_date DESC
   LIMIT 15000
`;

const PHL_BBOX = { minLat: 39.85, maxLat: 40.15, minLng: -75.30, maxLng: -74.95 };

function cleanName(s) {
  if (!s) return null;
  // Strip leading/trailing whitespace + semicolons. Take first grantee/
  // grantor if there are multiple (joined by '; '). Keeps queries readable
  // without dropping the join.
  return String(s).replace(/\s+/g, " ").trim() || null;
}

async function main() {
  console.log("fetching real-estate transfers...");
  const resp = await fetch(`${CARTO}?q=${encodeURIComponent(SQL)}`);
  if (!resp.ok) throw new Error(`carto ${resp.status}`);
  const json = await resp.json();
  const rows = json.rows ?? [];
  console.log(`got ${rows.length} rows`);

  // Don't TRUNCATE on an empty pull — a Carto hiccup returning zero rows would
  // otherwise wipe the whole table and "succeed" with 0 loaded.
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
    await client.query("TRUNCATE civic.transfers RESTART IDENTITY");
    for (const r of rows) {
      const lat = Number(r.lat), lng = Number(r.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
      if (lat < PHL_BBOX.minLat || lat > PHL_BBOX.maxLat) continue;
      if (lng < PHL_BBOX.minLng || lng > PHL_BBOX.maxLng) continue;
      const date = r.display_date ? r.display_date.slice(0, 10) : null;
      if (!date) continue;
      if (r.document_id == null) continue; // external_id is the conflict key; skip null
      // SAVEPOINT per row: a failed INSERT aborts only its own subtransaction.
      // Without this, one bad row poisons the whole BEGIN/COMMIT — every later
      // query errors and COMMIT silently rolls back, discarding the entire load.
      await client.query("SAVEPOINT row");
      try {
        await client.query(
          `INSERT INTO civic.transfers
             (external_id, document_type, transfer_date, address, zip,
              grantor, grantee, consideration, fair_market_value, geom)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,
                   ST_SetSRID(ST_MakePoint($10,$11),4326)::geography)
           ON CONFLICT (external_id) DO NOTHING`,
          [
            String(r.document_id), r.document_type, date,
            r.street_address, r.zip_code,
            cleanName(r.grantors), cleanName(r.grantees),
            r.total_consideration != null ? Number(r.total_consideration) : null,
            r.fair_market_value != null ? Number(r.fair_market_value) : null,
            lng, lat,
          ],
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
  console.log(`done. ${n} transfers loaded${failed ? `, ${failed} rows failed` : ""}.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
