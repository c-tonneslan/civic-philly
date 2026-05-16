import Link from "next/link";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import { getDatasource } from "@/lib/datasources";
import { STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from "@/lib/types";
import MiniMap from "@/components/MiniMap";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(Number(id));
  if (!project) notFound();
  const ds = await getDatasource(project.datasource_id);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>

        <div className="mt-4 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[project.project_type] }} />
          <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">
            {TYPE_LABELS[project.project_type]} · {STATUS_LABELS[project.status]}
          </span>
        </div>

        <h1 className="mt-2 text-3xl font-semibold tracking-tight leading-tight">{project.name}</h1>
        {project.address && <p className="mt-2 text-[var(--ink-dim)]">{project.address}</p>}

        {project.description && (
          <p className="mt-6 text-[15px] leading-relaxed text-[var(--ink)]/90">{project.description}</p>
        )}

        <dl className="mt-8 grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-5 text-sm">
          <Field label="Neighborhood" value={project.neighborhood} />
          <Field label="Council district" value={project.council_district} />
          <Field label="ZIP" value={project.zip_code} />
          <Field label="Funding source" value={project.funding_source} />
          <Field label="Funding amount" value={project.funding_amount != null ? `$${project.funding_amount.toLocaleString()}` : null} />
          <Field label="Total units" value={project.units_total != null && project.units_total > 0 ? String(project.units_total) : null} />
          <Field label="Affordable units" value={project.units_affordable != null && project.units_affordable > 0 ? String(project.units_affordable) : null} />
          <Field label="Approved" value={project.approved_date} />
          <Field label="Start date" value={project.start_date} />
          <Field label="Completion" value={project.completion_date} />
          <Field label="First seen in feed" value={project.first_seen_at ? new Date(project.first_seen_at).toLocaleDateString() : null} />
        </dl>

        <div className="mt-8 h-72 rounded-lg overflow-hidden border border-[var(--line)]">
          <MiniMap lat={project.lat} lng={project.lng} color={TYPE_COLORS[project.project_type]} />
        </div>

        {ds && (
          <div className="mt-8 border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-2">
              Data source · {ds.status === "ok" ? "" : `${ds.status} · `}
              {ds.last_fetched_at ? `last refreshed ${new Date(ds.last_fetched_at).toLocaleString()}` : "never refreshed"}
            </div>
            <div className="text-sm font-medium">{ds.name}</div>
            <div className="text-xs text-[var(--ink-dim)] mb-3">{ds.agency}</div>
            {ds.quality_notes && (
              <p className="text-[13px] text-[var(--ink)]/85 leading-relaxed whitespace-pre-line">
                {ds.quality_notes}
              </p>
            )}
            <div className="mt-3 flex gap-4 text-xs">
              {ds.homepage_url && (
                <a href={ds.homepage_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">
                  Source homepage
                </a>
              )}
              {project.source_url && project.source_url !== ds.homepage_url && (
                <a href={project.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">
                  Original record
                </a>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1">{label}</dt>
      <dd className="text-[var(--ink)]">{value}</dd>
    </div>
  );
}
