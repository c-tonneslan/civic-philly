import Link from "next/link";
import { notFound } from "next/navigation";
import { getDistrict, getDistrictOfficial, getDistrictTimeSeries } from "@/lib/context";
import { listProjects } from "@/lib/projects";
import { STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from "@/lib/types";
import TimeSeriesChart from "@/components/TimeSeriesChart";

export const dynamic = "force-dynamic";

export default async function DistrictPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const districtId = parseInt(id, 10);
  if (!Number.isFinite(districtId)) notFound();

  const [district, official, projects, series] = await Promise.all([
    getDistrict(districtId),
    getDistrictOfficial(districtId),
    listProjects({ districtId }, 50, 0).catch(() => []),
    getDistrictTimeSeries(districtId).catch(() => []),
  ]);
  if (!district) notFound();

  const csvUrl = `/api/export.csv?district=${districtId}`;
  const mapUrl = `/?district=${districtId}`;

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/districts" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; all districts
        </Link>

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">District {district.district_id}</h1>
            {official && (
              <p className="mt-1 text-[var(--ink-dim)]">
                Represented by <span className="text-[var(--ink)]">{official.name}</span> ({official.party})
              </p>
            )}
          </div>
          <div className="flex gap-2 text-xs">
            <Link href={mapUrl} className="px-3 py-1.5 rounded border border-[var(--line)] hover:bg-[var(--panel-2)]">
              View on map &rarr;
            </Link>
            <a href={csvUrl} className="px-3 py-1.5 rounded border border-[var(--line)] hover:bg-[var(--panel-2)]">
              Export CSV
            </a>
          </div>
        </div>

        <section className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card label="Total projects" value={district.total_projects} />
          <Card label="Under construction" value={district.active_projects} />
          <Card label="In pipeline" value={district.pipeline_projects} />
          <Card label="Completed" value={district.completed_projects} />
          <Card label="Housing units (total)" value={district.housing_units_total ?? 0} />
          <Card label="Affordable units" value={district.housing_units_affordable ?? 0} />
          <Card label="Capital funding" value={district.total_funding_amount != null ? `$${(Number(district.total_funding_amount)/1_000_000).toFixed(1)}M` : "—"} />
          <Card label="Datasets" value={`H ${district.housing_projects} · T ${district.transit_projects} · Z ${district.zoning_projects} · I ${district.infrastructure_projects}`} small />
        </section>

        {official && (
          <section className="mt-8 border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-2">
              How to contact your representative
            </div>
            <div className="text-base font-medium">{official.name}</div>
            <div className="text-xs text-[var(--ink-dim)] mb-3">Council District {district.district_id} · {official.party}</div>
            <div className="text-xs space-y-1.5">
              {official.email && <div><a href={`mailto:${official.email}`} className="underline underline-offset-2 hover:text-[var(--ink)]">{official.email}</a></div>}
              {official.phone && <div className="text-[var(--ink-dim)]">{official.phone}</div>}
              {official.office_address && <div className="text-[var(--ink-dim)]">{official.office_address}</div>}
              {official.website && <div><a href={official.website} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">official site</a></div>}
            </div>
          </section>
        )}

        <section className="mt-10">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-medium">Activity over time</h2>
            <span className="text-xs text-[var(--ink-dim)]">by project type, by year</span>
          </div>
          <div className="border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
            <TimeSeriesChart buckets={series} />
          </div>
        </section>

        <section className="mt-10">
          <div className="flex items-end justify-between mb-3">
            <h2 className="text-lg font-medium">Recent activity in the district</h2>
            <span className="text-xs text-[var(--ink-dim)]">showing {projects.length}</span>
          </div>
          <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block px-4 py-3 hover:bg-[var(--panel-2)] transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[p.project_type] }} />
                  <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">
                    {TYPE_LABELS[p.project_type]} · {STATUS_LABELS[p.status]}
                  </span>
                </div>
                <div className="text-sm font-medium">{p.name}</div>
                {p.address && <div className="text-xs text-[var(--ink-dim)] mt-0.5">{p.address}</div>}
              </Link>
            ))}
            {projects.length === 0 && (
              <div className="p-5 text-sm text-[var(--ink-dim)]">No projects on file for this district.</div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1">{label}</div>
      <div className={`${small ? "text-sm" : "text-2xl"} font-medium text-[var(--ink)]`}>{value}</div>
    </div>
  );
}
