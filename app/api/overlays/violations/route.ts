import { NextResponse } from "next/server";
import { query } from "@/lib/db";

export async function GET() {
  const r = await query<{ id: string; lat: number; lng: number; violation_date: string; violation_type: string | null }>(
    `SELECT id::text, violation_date, violation_type,
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM civic.violations
      WHERE violation_date >= NOW() - INTERVAL '1 year'`,
  );
  const features = r.rows.map((row) => ({
    type: "Feature" as const,
    properties: { id: row.id, violation_date: row.violation_date, violation_type: row.violation_type },
    geometry: { type: "Point" as const, coordinates: [Number(row.lng), Number(row.lat)] },
  }));
  return NextResponse.json(
    { type: "FeatureCollection", features },
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
