// City of Philadelphia Capital Program Projects loader.
//
//   node scripts/scrape-infrastructure.mjs

import {
  pool, fetchArcgisAll, pointFromFeature, upsertProjects, asNumber, asDate,
} from "./_lib.mjs";

const ENDPOINT =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/Capital_Program_Projects/FeatureServer/0/query";
const DATASOURCE = "phl-infrastructure";

function normalizeStatus(s) {
  const v = (s || "").toLowerCase();
  if (v.includes("complete")) return "completed";
  if (v.includes("construction") || v.includes("in progress")) return "under_construction";
  if (v.includes("design") || v.includes("planning") || v.includes("proposed")) return "proposed";
  if (v.includes("approved") || v.includes("award")) return "approved";
  if (v.includes("cancel") || v.includes("hold")) return "cancelled";
  return "unknown";
}

function toProject(feat) {
  const a = feat.attributes || {};
  const pt = pointFromFeature(feat);
  if (!pt) return null;

  const id = a.project_id || a.cpp_id || a.objectid;
  return {
    external_id: String(id),
    project_type: "infrastructure",
    name: a.project_name || a.title || `Capital project ${id}`,
    description: a.description || a.project_description || null,
    address: a.location || a.address || null,
    neighborhood: a.neighborhood || null,
    council_district: a.council_district ? String(a.council_district) : null,
    status: normalizeStatus(a.status || a.phase),
    funding_source: a.funding_source || a.fund_source || "City Capital Program",
    funding_amount: asNumber(a.total_budget || a.project_cost || a.estimated_cost),
    start_date: asDate(a.start_date),
    completion_date: asDate(a.completion_date || a.end_date),
    source_url: "https://opendataphilly.org/datasets/capital-program-projects/",
    raw_attrs: a,
    lat: pt.lat,
    lng: pt.lng,
  };
}

async function main() {
  console.log(`fetching ${DATASOURCE}...`);
  const features = await fetchArcgisAll(ENDPOINT);
  console.log(`got ${features.length} features`);
  const projects = features.map(toProject).filter(Boolean);
  console.log(`upserting ${projects.length} projects...`);
  const { inserted, updated } = await upsertProjects(DATASOURCE, projects);
  console.log(`done. ${inserted} new, ${updated} updated.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
