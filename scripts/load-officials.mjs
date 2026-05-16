// Load Philadelphia elected officials from a hand-curated JSON.
// (City Council x10 districts, x7 at-large, plus the mayor.)
//
//   node scripts/load-officials.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool } from "./_lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const raw = readFileSync(join(here, "..", "data", "officials.json"), "utf8");
  const data = JSON.parse(raw);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM civic.elected_officials");

    const m = data.mayor;
    await client.query(
      `INSERT INTO civic.elected_officials
         (role, name, party, email, phone, office_address, website, twitter)
       VALUES ('mayor', $1, $2, $3, $4, $5, $6, $7)`,
      [m.name, m.party, m.email, m.phone, m.office_address, m.website, m.twitter || null],
    );

    for (const d of data.districts) {
      await client.query(
        `INSERT INTO civic.elected_officials
           (role, district_id, name, party, email, phone, office_address, website)
         VALUES ('council_district', $1, $2, $3, $4, $5, $6, $7)`,
        [d.district_id, d.name, d.party, d.email, d.phone, d.office_address, d.website],
      );
    }

    for (const a of data.at_large) {
      await client.query(
        `INSERT INTO civic.elected_officials
           (role, name, party, email, phone, office_address, website)
         VALUES ('council_at_large', $1, $2, $3, $4, $5, $6)`,
        [a.name, a.party, a.email, a.phone, a.office_address, a.website],
      );
    }

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
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
