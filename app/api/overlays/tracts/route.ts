import { NextResponse } from "next/server";
import { getTractsForChoropleth } from "@/lib/context";

const VALID = ["rent_burdened", "renter", "income", "white", "black", "hispanic", "asian"] as const;
type Metric = typeof VALID[number];

export async function GET(req: Request) {
  const metric = new URL(req.url).searchParams.get("metric") || "rent_burdened";
  if (!(VALID as readonly string[]).includes(metric)) {
    return NextResponse.json({ error: "invalid metric" }, { status: 400 });
  }
  const rows = await getTractsForChoropleth(metric as Metric);
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
