// Refresh the displacement-pressure materialized view. Run as the FINAL step of
// the loader sequence (after load-census, load-violations, load-displacement,
// load-transfers + backfill-spatial) — NOT wired into scrape-all.mjs, which only
// runs the project scrapers and would leave the DPI inputs stale.
//
//   node scripts/build-dpi.mjs

import { pool } from "./_lib.mjs";

const MV = "civic.tract_displacement_index";

const pop = await pool.query(
  `SELECT ispopulated FROM pg_matviews
    WHERE schemaname = 'civic' AND matviewname = 'tract_displacement_index'`,
);
if (pop.rows.length === 0) {
  console.error("materialized view not found — run scripts/migrate.mjs first.");
  await pool.end();
  process.exit(1);
}

// CONCURRENTLY needs a populated MV + the unique index (both true after migrate),
// and avoids locking readers; fall back to a plain refresh if somehow unpopulated.
const concurrently = pop.rows[0].ispopulated ? "CONCURRENTLY " : "";
console.log(`refreshing ${MV} ${concurrently ? "(concurrently)" : ""}...`);
await pool.query(`REFRESH MATERIALIZED VIEW ${concurrently}${MV}`);

const n = (await pool.query(`SELECT COUNT(*)::int AS n FROM ${MV}`)).rows[0].n;
console.log(`done. ${n} tracts scored.`);
await pool.end();
