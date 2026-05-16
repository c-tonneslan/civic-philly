// Stamp the `developer` column on every project from the per-source raw
// attributes. Run after a scrape or any time the source data shifts.
//
//   node scripts/backfill-developers.mjs

import { pool } from "./_lib.mjs";

function clean(s) {
  if (!s) return null;
  const t = String(s).trim();
  if (!t || t.toLowerCase() === "n/a" || t === "—") return null;
  // Normalize whitespace.
  return t.replace(/\s+/g, " ").trim();
}

async function main() {
  const client = await pool.connect();
  let n = 0;
  try {
    const r = await client.query(
      `SELECT id, datasource_id, raw_attrs FROM civic.projects WHERE developer IS NULL`,
    );
    console.log(`considering ${r.rows.length} projects without a developer set`);
    await client.query("BEGIN");
    for (const row of r.rows) {
      const attrs = row.raw_attrs || {};
      let dev = null;
      if (row.datasource_id === "phl-housing") {
        dev = clean(attrs.developer_name);
      } else if (row.datasource_id === "phl-zoning") {
        dev = clean(attrs.contractorname);
      }
      // SEPTA + infrastructure projects don't have a distinct developer
      // field; we leave those null and the UI just doesn't show a row.
      if (dev) {
        await client.query("UPDATE civic.projects SET developer = $1 WHERE id = $2", [dev, row.id]);
        n++;
      }
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  console.log(`done. ${n} developers stamped.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
