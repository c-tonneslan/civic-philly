import { ImageResponse } from "next/og";
import { getDistrict, getDistrictOfficial } from "@/lib/context";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function DistrictOG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const districtId = parseInt(id, 10);
  const [district, official] = await Promise.all([
    getDistrict(districtId),
    getDistrictOfficial(districtId),
  ]);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: "flex", flexDirection: "column",
          padding: 80, background: "#0b0c0e", color: "#e7ebef",
          fontFamily: "Inter, sans-serif",
        }}
      >
        <div style={{ fontSize: 22, color: "#9aa3ad", textTransform: "uppercase", letterSpacing: 2, marginBottom: 12 }}>
          City Council Briefing
        </div>
        <div style={{ fontSize: 100, fontWeight: 700, letterSpacing: -2, lineHeight: 1, display: "flex" }}>
          District {district?.district_id ?? districtId}
        </div>
        {official && (
          <div style={{ marginTop: 16, fontSize: 32, color: "#9aa3ad", display: "flex" }}>
            {official.name}
          </div>
        )}
        <div style={{ flex: 1 }} />
        {district && (
          <div style={{ display: "flex", gap: 48 }}>
            <Stat label="Total projects" value={district.total_projects.toLocaleString()} />
            <Stat label="Active" value={district.active_projects.toLocaleString()} />
            <Stat label="Housing units" value={(district.housing_units_total ?? 0).toLocaleString()} />
            {district.total_funding_amount != null && (
              <Stat label="Funding" value={`$${(Number(district.total_funding_amount) / 1_000_000).toFixed(0)}M`} />
            )}
          </div>
        )}
        <div style={{ marginTop: 32, fontSize: 20, color: "#ffd166", display: "flex" }}>
          civic-philly.vercel.app/districts/{districtId}
        </div>
      </div>
    ),
    size,
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      <div style={{ fontSize: 14, color: "#9aa3ad", textTransform: "uppercase", letterSpacing: 1.5 }}>{label}</div>
      <div style={{ fontSize: 48, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
