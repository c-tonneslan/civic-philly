// Load Philadelphia City Council district boundaries.
// Source: city ArcGIS feature service.
//
//   node scripts/load-districts.mjs

import { pool } from "./_lib.mjs";

const ENDPOINT =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/Council_Districts_2024/FeatureServer/0/query";

async function fetchDistricts() {
  const params = new URLSearchParams({
    where: "1=1",
    outFields: "district",
    outSR: "4326",
    returnGeometry: "true",
    f: "geojson",
  });
  const resp = await fetch(`${ENDPOINT}?${params}`);
  if (!resp.ok) throw new Error(`arcgis ${resp.status}: ${resp.statusText}`);
  return resp.json();
}

async function main() {
  console.log("fetching council districts...");
  const fc = await fetchDistricts();
  const features = fc.features ?? [];
  console.log(`got ${features.length} districts`);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const f of features) {
      const id = parseInt(f.properties.district, 10);
      // ArcGIS returns Polygon or MultiPolygon. Coerce both to MultiPolygon
      // since the column is MultiPolygon.
      const geom = f.geometry.type === "Polygon"
        ? { type: "MultiPolygon", coordinates: [f.geometry.coordinates] }
        : f.geometry;
      await client.query(
        `INSERT INTO civic.council_districts (id, name, geom)
         VALUES ($1, $2, ST_SetSRID(ST_GeomFromGeoJSON($3),4326)::geography)
         ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, geom = EXCLUDED.geom`,
        [id, `District ${id}`, JSON.stringify(geom)],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
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
