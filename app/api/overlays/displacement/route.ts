import { NextResponse } from "next/server";
import { getDpiChoropleth } from "@/lib/displacement";

// Single-score overlay (no metric param), mirroring app/api/overlays/tracts.
export async function GET() {
  const rows = await getDpiChoropleth();
  const features = rows.map((r) => ({
    type: "Feature" as const,
    properties: { geoid: r.geoid, value: r.value },
    geometry: JSON.parse(r.geom_geojson),
  }));
  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
