// Load Philadelphia census tracts (2020 TIGER boundaries) plus the 5-year
// ACS variables that matter for the equity overlay:
//   - total population (B01003_001E)
//   - median household income (B19013_001E)
//   - households spending 30%+ of income on rent ("rent burdened")
//     (B25070_007E..010E summed / B25070_001E)
//   - renter-occupied share (B25003_003E / B25003_001E)
//   - racial composition (B03002 series)
//
// Boundaries come from the Census TIGER ArcGIS feature service (state 42,
// county 101 = Philadelphia).
//
//   CENSUS_API_KEY=... node scripts/load-census.mjs

import { pool } from "./_lib.mjs";

const STATE = "42";
const COUNTY = "101";
const YEAR = 2022; // 5-year ACS 2018-2022, latest fully released at time of writing

const ACS_VARS = [
  "NAME",
  "B01003_001E",            // total pop
  "B19013_001E",            // median household income
  "B25070_001E",            // gross rent as % of income: denom (renter HHs)
  "B25070_007E",            // 30-34.9%
  "B25070_008E",            // 35-39.9%
  "B25070_009E",            // 40-49.9%
  "B25070_010E",            // 50%+
  "B25003_001E",            // tenure: total occupied HHs
  "B25003_003E",            // renter occupied
  "B03002_003E",            // non-hisp white
  "B03002_004E",            // non-hisp black
  "B03002_006E",            // non-hisp asian
  "B03002_012E",            // hispanic any race
];

const TIGER_ENDPOINT =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/TIGERweb/Tracts_Blocks/MapServer/0/query";

function asNum(v) {
  if (v == null) return null;
  const n = parseFloat(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

function pct(num, denom) {
  // Only the denominator being missing/zero makes the ratio undefined. Guard on
  // that alone — a numerator of 0 is a legitimate 0%, not missing data, so the
  // old `!num` check wrongly nulled out real zeros (e.g. 0% of a group present).
  if (num == null || denom == null || denom === 0) return null;
  return Math.round((num / denom) * 10000) / 100;
}

async function fetchACS() {
  const key = process.env.CENSUS_API_KEY;
  if (!key) throw new Error("CENSUS_API_KEY not set");
  const get = ACS_VARS.join(",");
  const url = `https://api.census.gov/data/${YEAR}/acs/acs5?get=${get}&for=tract:*&in=state:${STATE}+county:${COUNTY}&key=${key}`;
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`acs ${resp.status}: ${resp.statusText}`);
  const rows = await resp.json();
  // rows[0] is header
  const header = rows[0];
  const tractIdx = header.indexOf("tract");
  const stateIdx = header.indexOf("state");
  const countyIdx = header.indexOf("county");
  const out = new Map();
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const geoid = row[stateIdx] + row[countyIdx] + row[tractIdx];
    const rec = {};
    for (let j = 0; j < header.length; j++) rec[header[j]] = row[j];
    out.set(geoid, rec);
  }
  return out;
}

async function fetchTracts() {
  const params = new URLSearchParams({
    where: `STATE='${STATE}' AND COUNTY='${COUNTY}'`,
    outFields: "GEOID,NAME,BASENAME",
    outSR: "4326",
    returnGeometry: "true",
    f: "geojson",
    resultRecordCount: "2000",
  });
  const resp = await fetch(`${TIGER_ENDPOINT}?${params}`);
  if (!resp.ok) throw new Error(`tiger ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

async function main() {
  console.log("fetching ACS 5y data...");
  const acs = await fetchACS();
  console.log(`got ${acs.size} ACS rows`);

  console.log("fetching TIGER tract geometries...");
  const fc = await fetchTracts();
  const features = fc.features ?? [];
  console.log(`got ${features.length} tract geometries`);

  const client = await pool.connect();
  let upserted = 0;
  try {
    await client.query("BEGIN");
    for (const f of features) {
      const geoid = f.properties.GEOID;
      const rec = acs.get(geoid);
      if (!rec) continue;

      const totalPop = asNum(rec.B01003_001E);
      const income = asNum(rec.B19013_001E);
      const rentDenom = asNum(rec.B25070_001E);
      const rentBurdNum = (asNum(rec.B25070_007E) ?? 0)
        + (asNum(rec.B25070_008E) ?? 0)
        + (asNum(rec.B25070_009E) ?? 0)
        + (asNum(rec.B25070_010E) ?? 0);
      const tenureTotal = asNum(rec.B25003_001E);
      const renters = asNum(rec.B25003_003E);
      const ethTotal = asNum(rec.B03002_003E) + asNum(rec.B03002_004E)
        + asNum(rec.B03002_006E) + asNum(rec.B03002_012E);

      const geom = f.geometry.type === "Polygon"
        ? { type: "MultiPolygon", coordinates: [f.geometry.coordinates] }
        : f.geometry;

      await client.query(
        `INSERT INTO civic.census_tracts
           (geoid, name, total_pop, median_hh_income,
            pct_rent_burdened, pct_renter,
            pct_white, pct_black, pct_hispanic, pct_asian,
            acs_year, geom)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,
                 ST_SetSRID(ST_GeomFromGeoJSON($12),4326)::geography)
         ON CONFLICT (geoid) DO UPDATE SET
           name = EXCLUDED.name,
           total_pop = EXCLUDED.total_pop,
           median_hh_income = EXCLUDED.median_hh_income,
           pct_rent_burdened = EXCLUDED.pct_rent_burdened,
           pct_renter = EXCLUDED.pct_renter,
           pct_white = EXCLUDED.pct_white,
           pct_black = EXCLUDED.pct_black,
           pct_hispanic = EXCLUDED.pct_hispanic,
           pct_asian = EXCLUDED.pct_asian,
           acs_year = EXCLUDED.acs_year,
           geom = EXCLUDED.geom`,
        [
          geoid,
          rec.NAME,
          totalPop,
          income,
          pct(rentBurdNum, rentDenom),
          pct(renters, tenureTotal),
          pct(asNum(rec.B03002_003E), totalPop),
          pct(asNum(rec.B03002_004E), totalPop),
          pct(asNum(rec.B03002_012E), totalPop),
          pct(asNum(rec.B03002_006E), totalPop),
          YEAR,
          JSON.stringify(geom),
        ],
      );
      upserted++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  console.log(`done. ${upserted} tracts upserted.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
