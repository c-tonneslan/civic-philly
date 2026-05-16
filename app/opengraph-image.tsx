import { ImageResponse } from "next/og";
import { getWeekHeadlines } from "@/lib/digest";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function HomepageOG() {
  const h = await getWeekHeadlines(7).catch(() => null);

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: "flex", flexDirection: "column",
          padding: 80, background: "#0b0c0e", color: "#e7ebef",
        }}
      >
        <div style={{ fontSize: 22, color: "#9aa3ad", display: "flex", marginBottom: 16 }}>
          civic-philly
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.02, display: "flex" }}>
          What's being built
        </div>
        <div style={{ fontSize: 88, fontWeight: 700, lineHeight: 1.02, display: "flex" }}>
          in Philadelphia.
        </div>

        <div style={{ flex: 1, display: "flex" }} />

        {h && (
          <div style={{ display: "flex", gap: 56 }}>
            <Stat label="New this week" value={h.total_new.toLocaleString()} />
            <Stat label="Status changes" value={h.status_changes.toLocaleString()} />
            <Stat label="Demolitions" value={h.new_demolitions.toLocaleString()} />
            <Stat label="Violations" value={h.new_violations.toLocaleString()} />
          </div>
        )}

        <div style={{ marginTop: 32, fontSize: 20, color: "#ffd166", display: "flex" }}>
          civic-philly.vercel.app
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
      <div style={{ fontSize: 52, fontWeight: 600 }}>{value}</div>
    </div>
  );
}
