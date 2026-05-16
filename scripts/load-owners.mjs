// Load OPA property ownership data for the parcels that show up in our
// projects table. Don't pull the full 600k+ OPA universe; only the
// parcels we care about. Fetches in chunks to stay under Carto's URL
// length limit.
//
//   node scripts/load-owners.mjs

import { pool } from "./_lib.mjs";

const CARTO = "https://phl.carto.com/api/v2/sql";

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

async function fetchChunk(parcels) {
  const list = parcels.map((p) => `'${p.replace(/'/g, "''")}'`).join(",");
  const q = `
    SELECT parcel_number, owner_1, owner_2,
           mailing_address_1, mailing_city_state, mailing_zip,
           location, market_value
      FROM opa_properties_public
     WHERE parcel_number IN (${list})
  `;
  const resp = await fetch(`${CARTO}?q=${encodeURIComponent(q)}`);
  if (!resp.ok) throw new Error(`carto ${resp.status}`);
  const json = await resp.json();
  return json.rows ?? [];
}

async function main() {
  const client = await pool.connect();
  try {
    const r = await client.query(
      `SELECT DISTINCT opa_account FROM civic.projects WHERE opa_account IS NOT NULL`,
    );
    const parcels = r.rows.map((x) => x.opa_account).filter(Boolean);
    console.log(`looking up ${parcels.length} OPA accounts...`);

    let inserted = 0;
    for (const batch of chunk(parcels, 200)) {
      const rows = await fetchChunk(batch);
      for (const row of rows) {
        const mv = row.market_value != null ? Math.round(Number(row.market_value)) : null;
        await client.query(
          `INSERT INTO civic.property_owners
             (parcel_number, owner_1, owner_2,
              mailing_address, mailing_city_state, mailing_zip,
              location_address, market_value)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
           ON CONFLICT (parcel_number) DO UPDATE SET
             owner_1 = EXCLUDED.owner_1,
             owner_2 = EXCLUDED.owner_2,
             mailing_address = EXCLUDED.mailing_address,
             mailing_city_state = EXCLUDED.mailing_city_state,
             mailing_zip = EXCLUDED.mailing_zip,
             location_address = EXCLUDED.location_address,
             market_value = EXCLUDED.market_value,
             imported_at = NOW()`,
          [
            row.parcel_number, row.owner_1, row.owner_2,
            row.mailing_address_1, row.mailing_city_state, row.mailing_zip,
            row.location, mv,
          ],
        );
        inserted++;
      }
      console.log(`  ${inserted} loaded so far`);
    }
  } finally {
    client.release();
  }
  console.log("done.");
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
