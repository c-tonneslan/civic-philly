// Philadelphia ZBA decisions loader.
//
//   node scripts/scrape-zoning.mjs

import {
  pool, fetchArcgisAll, pointFromFeature, upsertProjects, asDate,
} from "./_lib.mjs";

const ENDPOINT =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/ZBA_Decisions/FeatureServer/0/query";
const DATASOURCE = "phl-zoning";

const PHL_BBOX = { minLat: 39.85, maxLat: 40.15, minLng: -75.30, maxLng: -74.95 };

function normalizeStatus(decision) {
  const d = (decision || "").toLowerCase();
  if (d.includes("granted") || d.includes("approved")) return "approved";
  if (d.includes("denied") || d.includes("refused")) return "cancelled";
  if (d.includes("withdrawn") || d.includes("dismissed")) return "cancelled";
  if (d.includes("continued") || d.includes("pending")) return "proposed";
  return "unknown";
}

function toProject(feat) {
  const a = feat.attributes || {};
  const pt = pointFromFeature(feat);
  if (!pt) return null;
  if (pt.lat < PHL_BBOX.minLat || pt.lat > PHL_BBOX.maxLat) return null;
  if (pt.lng < PHL_BBOX.minLng || pt.lng > PHL_BBOX.maxLng) return null;

  const caseNo = a.application_number || a.app_number || a.objectid;
  return {
    external_id: String(caseNo),
    project_type: "zoning",
    name: `ZBA ${caseNo}: ${a.appeal_type || "Variance"}`,
    description: a.appeal_grounds || a.refusal_reason || null,
    address: a.address || a.location || null,
    neighborhood: a.neighborhood || null,
    council_district: a.council_district ? String(a.council_district) : null,
    zip_code: a.zip_code ? String(a.zip_code) : null,
    status: normalizeStatus(a.decision),
    approved_date: asDate(a.decision_date),
    source_url: "https://opendataphilly.org/datasets/zoning-board-of-adjustment-zba-decisions/",
    raw_attrs: a,
    lat: pt.lat,
    lng: pt.lng,
  };
}

async function main() {
  console.log(`fetching ${DATASOURCE}...`);
  const features = await fetchArcgisAll(ENDPOINT, {
    // ZBA data goes back to the 90s; we only care about the last 5 years
    // for "what's happening now". Adjust if you want a deeper history.
    where: "decision_date >= TIMESTAMP '2021-01-01 00:00:00'",
  });
  console.log(`got ${features.length} features`);
  const projects = features.map(toProject).filter(Boolean);
  console.log(`upserting ${projects.length} in-bounds projects...`);
  const { inserted, updated } = await upsertProjects(DATASOURCE, projects);
  console.log(`done. ${inserted} new, ${updated} updated.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
