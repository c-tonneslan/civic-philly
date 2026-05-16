// Major city capital infrastructure projects. Philadelphia doesn't publish
// the six-year capital program as a machine-readable feed (the dataset
// listed on OpenDataPhilly 404s), so this loads from data/phl-infrastructure.json,
// which is hand-curated from the published CIP and press releases.
// The data quality panel says so plainly.
//
//   node scripts/scrape-infrastructure.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { pool, upsertProjects } from "./_lib.mjs";

const DATASOURCE = "phl-infrastructure";
const here = dirname(fileURLToPath(import.meta.url));

async function main() {
  const raw = readFileSync(join(here, "..", "data", "phl-infrastructure.json"), "utf8");
  const items = JSON.parse(raw);
  const projects = items.map((p) => ({
    external_id: p.external_id,
    project_type: "infrastructure",
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
  console.log(`upserting ${projects.length} infrastructure projects...`);
  const { inserted, updated } = await upsertProjects(DATASOURCE, projects);
  console.log(`done. ${inserted} new, ${updated} updated.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
