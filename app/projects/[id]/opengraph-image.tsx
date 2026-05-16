import { ImageResponse } from "next/og";
import { getProject } from "@/lib/projects";
import { getDistrict } from "@/lib/context";
import { TYPE_COLORS, TYPE_LABELS, STATUS_LABELS } from "@/lib/types";

export const runtime = "nodejs";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function ProjectOG({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(Number(id));
  if (!project) {
    return new ImageResponse(
      (
        <div style={{ width: 1200, height: 630, display: "flex", background: "#0b0c0e", color: "#e7ebef", alignItems: "center", justifyContent: "center", fontSize: 48 }}>
          civic-philly
        </div>
      ),
      size,
    );
  }
  const district = project.council_district_id ? await getDistrict(project.council_district_id) : null;
  const color = TYPE_COLORS[project.project_type];

  const units = project.units_total != null && project.units_total > 0 ? `${project.units_total} units` : null;
  const funding = project.funding_amount != null
    ? `$${(Number(project.funding_amount) / 1_000_000).toFixed(1)}M`
    : null;
  const districtLabel = district ? `District ${district.district_id}` : null;
  const facts = [districtLabel, units, funding].filter(Boolean).join("   ·   ");

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: "flex", flexDirection: "column",
          padding: 80, background: "#0b0c0e", color: "#e7ebef",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: 32 }}>
          <div style={{ width: 14, height: 14, borderRadius: 7, background: color, marginRight: 16, display: "flex" }} />
          <div style={{ fontSize: 22, color: "#9aa3ad", display: "flex" }}>
            {TYPE_LABELS[project.project_type]} · {STATUS_LABELS[project.status]}
          </div>
        </div>
        <div style={{ fontSize: 64, fontWeight: 600, lineHeight: 1.05, display: "flex" }}>
          {project.name.length > 90 ? project.name.slice(0, 87) + "..." : project.name}
        </div>
        <div style={{ marginTop: 24, fontSize: 26, color: "#9aa3ad", display: "flex" }}>
          {project.address || "Philadelphia"}
        </div>
        <div style={{ flex: 1, display: "flex" }} />
        {facts && (
          <div style={{ fontSize: 32, color: "#e7ebef", marginBottom: 16, display: "flex" }}>{facts}</div>
        )}
        <div style={{ fontSize: 22, color: "#ffd166", display: "flex" }}>
          civic-philly.vercel.app
        </div>
      </div>
    ),
    size,
  );
}
