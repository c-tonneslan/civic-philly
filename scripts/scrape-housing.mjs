// Philadelphia affordable housing production loader.
//
//   node scripts/scrape-housing.mjs

import {
  pool, fetchArcgisAll, pointFromFeature, upsertProjects,
  asInt, asDate,
} from "./_lib.mjs";

const ENDPOINT =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/AffordableHousingProduction/FeatureServer/0/query";
const DATASOURCE = "phl-housing";

function normalizeStatus(devType, completionDate) {
  const dt = (devType || "").toLowerCase();
  if (completionDate) {
    const completed = new Date(completionDate);
    if (!Number.isNaN(completed.getTime()) && completed < new Date()) return "completed";
  }
  if (dt.includes("preservation")) return "completed";
  if (dt.includes("new construction")) return "under_construction";
  return "unknown";
}

function toProject(feat) {
  const a = feat.attributes || {};
  const pt = pointFromFeature(feat);
  if (!pt) return null;

  const units = asInt(a.total_units) ?? 0;
  const completion = asDate(a.fiscal_year_complete);
  return {
    external_id: String(a.objectid),
    project_type: "housing",
    name: (a.project_name || a.address || "Affordable housing project").trim(),
    description: a.development_type || null,
    address: a.address || null,
    neighborhood: a.neighborhood || null,
    zip_code: a.zip_code ? String(a.zip_code) : null,
    status: normalizeStatus(a.development_type, completion),
    funding_source: a.funding_source || "City of Philadelphia",
    funding_amount: null,
    units_total: units,
    units_affordable: units,
    completion_date: completion,
    source_url: "https://opendataphilly.org/datasets/affordable-housing-production/",
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
  console.log(`upserting ${projects.length} projects with valid coordinates...`);
  const { inserted, updated } = await upsertProjects(DATASOURCE, projects);
  console.log(`done. ${inserted} new, ${updated} updated.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
