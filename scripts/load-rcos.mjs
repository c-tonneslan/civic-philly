// Load Philadelphia Registered Community Organizations (RCOs).
// These are the legally-required input bodies for any zoning project,
// so knowing which one covers a given site is critical for organizers.
//
//   node scripts/load-rcos.mjs

import { pool } from "./_lib.mjs";

const ENDPOINT =
  "https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/Zoning_RCO/FeatureServer/0/query";

async function fetchAll() {
  const out = [];
  let offset = 0;
  while (true) {
    const params = new URLSearchParams({
      where: "1=1", outFields: "*", outSR: "4326",
      returnGeometry: "true", f: "geojson",
      resultOffset: String(offset), resultRecordCount: "2000",
    });
    const resp = await fetch(`${ENDPOINT}?${params}`);
    if (!resp.ok) throw new Error(`arcgis ${resp.status}`);
    const fc = await resp.json();
    const feats = fc.features ?? [];
    out.push(...feats);
    if (feats.length < 2000) break;
    offset += feats.length;
  }
  return out;
}

async function main() {
  console.log("fetching RCOs...");
  const features = await fetchAll();
  console.log(`got ${features.length} features`);

  const client = await pool.connect();
  let n = 0;
  try {
    await client.query("BEGIN");
    // Don't TRUNCATE: projects.rco_id has an FK so CASCADE would wipe
    // projects. DELETE preserves referential integrity by letting the
    // FK constraint NULL out dependent rows itself if we ever switch
    // to ON DELETE SET NULL. For now we just delete and reseed.
    await client.query("UPDATE civic.projects SET rco_id = NULL");
    await client.query("DELETE FROM civic.rcos");
    await client.query("ALTER SEQUENCE civic.rcos_id_seq RESTART WITH 1");
    for (const f of features) {
      const a = f.properties || {};
      if (!a.organization_name) continue;
      const geom = f.geometry?.type === "Polygon"
        ? { type: "MultiPolygon", coordinates: [f.geometry.coordinates] }
        : f.geometry;
      if (!geom) continue;
      await client.query(
        `INSERT INTO civic.rcos
           (external_id, name, primary_email, primary_phone, primary_name,
            website, meeting_info, geom)
         VALUES ($1,$2,$3,$4,$5,$6,$7,
                 ST_SetSRID(ST_GeomFromGeoJSON($8),4326)::geography)`,
        [
          String(a.lni_id || a.objectid),
          a.organization_name,
          a.primary_email,
          a.primary_phone,
          a.primary_name,
          a.websites,
          a.meeting_location_address,
          JSON.stringify(geom),
        ],
      );
      n++;
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
  console.log(`done. ${n} RCOs loaded.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
