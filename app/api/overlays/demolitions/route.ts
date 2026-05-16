import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const r = await query<{ id: string; lat: number; lng: number; event_date: string }>(
    `SELECT id::text, event_date,
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM civic.displacement_signals
      WHERE event_date >= NOW() - INTERVAL '3 years'`,
  );
  const features = r.rows.map((row) => ({
    type: "Feature" as const,
    properties: { id: row.id, event_date: row.event_date },
    geometry: { type: "Point" as const, coordinates: [Number(row.lng), Number(row.lat)] },
  }));
  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
