// One-shot spatial join: stamp every project with the council district
// and census tract it falls inside. Run after the boundary loaders (and
// after every scrape, since new projects don't have these denormalized
// columns yet).
//
//   node scripts/backfill-spatial.mjs

import { pool } from "./_lib.mjs";

async function main() {
  const client = await pool.connect();
  try {
    console.log("backfilling council_district_id...");
    const r1 = await client.query(`
      UPDATE civic.projects p
         SET council_district_id = d.id
        FROM civic.council_districts d
       WHERE ST_Intersects(p.geom, d.geom)
         AND (p.council_district_id IS NULL OR p.council_district_id <> d.id)
      `);
    console.log(`  updated ${r1.rowCount} projects with district`);

    console.log("backfilling census_tract_geoid...");
    const r2 = await client.query(`
      UPDATE civic.projects p
         SET census_tract_geoid = t.geoid
        FROM civic.census_tracts t
       WHERE ST_Intersects(p.geom, t.geom)
         AND (p.census_tract_geoid IS NULL OR p.census_tract_geoid <> t.geoid)
      `);
    console.log(`  updated ${r2.rowCount} projects with tract`);

    console.log("backfilling status_history (initial snapshot for rows missing one)...");
    const r3 = await client.query(`
      INSERT INTO civic.status_history (project_id, status, observed_at)
      SELECT p.id, p.status, p.first_seen_at
        FROM civic.projects p
       WHERE NOT EXISTS (
         SELECT 1 FROM civic.status_history h WHERE h.project_id = p.id
       )
      `);
    console.log(`  inserted ${r3.rowCount} initial snapshots`);
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
