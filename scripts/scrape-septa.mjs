// SEPTA capital projects loader. SEPTA doesn't publish a machine-readable
// capital project list, so we hand-curate from the published capital
// budget book and load from data/septa-capital.json. Be honest about this
// in the data quality notes; don't pretend it's a live feed.
//
//   node scripts/scrape-septa.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool, upsertProjects } from "./_lib.mjs";

const DATASOURCE = "septa-capital";
const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const raw = readFileSync(join(here, "..", "data", "septa-capital.json"), "utf8");
  const items = JSON.parse(raw);
  const projects = items.map((p) => ({
    external_id: p.external_id,
    project_type: "transit",
    name: p.name,
    description: p.description,
    address: p.address,
    neighborhood: p.neighborhood,
    status: p.status,
    funding_source: p.funding_source,
    funding_amount: p.funding_amount,
    start_date: p.start_date,
    completion_date: p.completion_date,
    source_url: p.source_url,
    raw_attrs: p,
    lat: p.lat,
    lng: p.lng,
  }));
  console.log(`upserting ${projects.length} SEPTA projects...`);
  const { inserted, updated } = await upsertProjects(DATASOURCE, projects);
  console.log(`done. ${inserted} new, ${updated} updated.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
