// Philadelphia zoning permits loader. Pulls from the city's Carto SQL API,
// which has L&I building and zoning permits from 2007 to present. We grab
// only the last 2 years of zoning-type permits.
//
//   node scripts/scrape-zoning.mjs

import { pool, upsertProjects, asDate } from "./_lib.mjs";

const CARTO = "https://phl.carto.com/api/v2/sql";
const DATASOURCE = "phl-zoning";

const PHL_BBOX = { minLat: 39.85, maxLat: 40.15, minLng: -75.30, maxLng: -74.95 };

const SQL = `
  SELECT permitnumber, permittype, permitdescription, typeofwork,
         approvedscopeofwork, status, permitissuedate, address, zip,
         opa_account_num, parcel_id_num,
         commercialorresidential, contractorname,
         ST_X(the_geom) AS lng, ST_Y(the_geom) AS lat
    FROM permits
   WHERE permittype IN ('Zoning','ZP_ZONING','ZP_USE','ZP_ADMIN')
     AND permitissuedate >= NOW() - INTERVAL '2 years'
     AND the_geom IS NOT NULL
   ORDER BY permitissuedate DESC
   LIMIT 5000
`;

function normalizeStatus(s) {
  const v = (s || "").toLowerCase();
  if (v.includes("complete") || v.includes("closed")) return "completed";
  if (v.includes("issued") || v.includes("active")) return "approved";
  if (v.includes("denied") || v.includes("revoked") || v.includes("void")) return "cancelled";
  if (v.includes("withdrawn") || v.includes("cancel")) return "cancelled";
  if (v.includes("pending") || v.includes("hold") || v.includes("review")) return "proposed";
  return "approved";
}

function toProject(row) {
  const lat = Number(row.lat);
  const lng = Number(row.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < PHL_BBOX.minLat || lat > PHL_BBOX.maxLat) return null;
  if (lng < PHL_BBOX.minLng || lng > PHL_BBOX.maxLng) return null;

  const name = row.permitdescription
    ? `Zoning: ${row.permitdescription}`
    : `Zoning permit ${row.permitnumber}`;

  return {
    external_id: row.permitnumber,
    project_type: "zoning",
    name,
    description: row.approvedscopeofwork || row.typeofwork || null,
    address: row.address || null,
    zip_code: row.zip || null,
    status: normalizeStatus(row.status),
    approved_date: asDate(row.permitissuedate),
    source_url: `https://www.phila.gov/li/PERMITS/Pages/PermitDetails.aspx?p=${encodeURIComponent(row.permitnumber)}`,
    raw_attrs: row,
    opa_account: row.opa_account_num || null,
    lat,
    lng,
  };
}

async function main() {
  console.log(`fetching ${DATASOURCE} from Carto...`);
  const url = `${CARTO}?q=${encodeURIComponent(SQL)}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`carto ${resp.status}: ${resp.statusText}`);
  const json = await resp.json();
  const rows = json.rows ?? [];
  console.log(`got ${rows.length} rows`);
  const projects = rows.map(toProject).filter(Boolean);
  console.log(`upserting ${projects.length} in-bounds zoning permits...`);
  const { inserted, updated } = await upsertProjects(DATASOURCE, projects);
  console.log(`done. ${inserted} new, ${updated} updated.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
