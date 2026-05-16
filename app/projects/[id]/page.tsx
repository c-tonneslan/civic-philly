import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getProject } from "@/lib/projects";
import { getDatasource } from "@/lib/datasources";
import {
  getSiblingProjects, getDistrict, getDistrictOfficial,
  getTract, getDisplacementWithin, getStatusHistory, getRCO,
} from "@/lib/context";
import { getOwnerByParcel } from "@/lib/owners";
import { STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from "@/lib/types";
import MiniMap from "@/components/MiniMap";
import StatusTimeline from "@/components/StatusTimeline";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const project = await getProject(Number(id)).catch(() => null);
  if (!project) return { title: "Project not found · civic-philly" };
  const bits = [
    project.address,
    project.neighborhood,
    project.units_total ? `${project.units_total} units` : null,
    project.developer,
  ].filter(Boolean).join(" · ");
  return {
    title: `${project.name} · civic-philly`,
    description: bits || "Project on the civic-philly map.",
    openGraph: { title: project.name, description: bits },
  };
}

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const project = await getProject(Number(id));
  if (!project) notFound();
  const [ds, siblings, district, official, tract, demolitions, history, rco, owner] = await Promise.all([
    getDatasource(project.datasource_id),
    getSiblingProjects(project.lat, project.lng, 400, project.id, 8),
    project.council_district_id ? getDistrict(project.council_district_id) : Promise.resolve(null),
    project.council_district_id ? getDistrictOfficial(project.council_district_id) : Promise.resolve(null),
    project.census_tract_geoid ? getTract(project.census_tract_geoid) : Promise.resolve(null),
    getDisplacementWithin(project.lat, project.lng, 400, 3, 20),
    getStatusHistory(project.id),
    project.rco_id ? getRCO(project.rco_id) : Promise.resolve(null),
    project.opa_account ? getOwnerByParcel(project.opa_account) : Promise.resolve(null),
  ]);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
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
          <Field label="Council district" value={district ? `District ${district.district_id}` : null} href={district ? `/districts/${district.district_id}` : undefined} />
          <Field label="Developer / applicant" value={project.developer} href={project.developer ? `/developers/${encodeURIComponent(project.developer)}` : undefined} />
          <Field label="Property owner" value={owner?.owner_1 ?? null} href={owner?.owner_1 ? `/owners/${encodeURIComponent(owner.owner_1)}` : undefined} />
          <Field label="OPA account" value={project.opa_account} />
          <Field label="Neighborhood" value={project.neighborhood} />
          <Field label="ZIP" value={project.zip_code} />
          <Field label="Funding source" value={project.funding_source} />
          <Field label="Funding amount" value={project.funding_amount != null ? `$${Number(project.funding_amount).toLocaleString()}` : null} />
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

        {/* Status timeline. Only shown if there's more than one snapshot,
            because every project has at least an initial one. */}
        {history.length > 1 && <StatusTimeline history={history} />}

        {/* Two-column context. Goal: answer "what does this mean?"
            instead of just showing one row. */}
        <section className="mt-10 grid md:grid-cols-2 gap-6">
          {official && district && (
            <div className="border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-2">
                Your council representative
              </div>
              <div className="text-base font-medium">{official.name}</div>
              <div className="text-xs text-[var(--ink-dim)] mb-3">District {district.district_id} · {official.party}</div>
              <div className="text-xs space-y-1.5">
                {official.email && <div><a href={`mailto:${official.email}`} className="underline underline-offset-2 hover:text-[var(--ink)]">{official.email}</a></div>}
                {official.phone && <div className="text-[var(--ink-dim)]">{official.phone}</div>}
                {official.office_address && <div className="text-[var(--ink-dim)]">{official.office_address}</div>}
                {official.website && <div><a href={official.website} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">official site</a></div>}
              </div>
              {district && (
                <div className="mt-4 pt-3 border-t border-[var(--line)] text-xs grid grid-cols-2 gap-2 text-[var(--ink-dim)]">
                  <div><span className="text-[var(--ink)]">{district.total_projects}</span> projects in this district</div>
                  <div><span className="text-[var(--ink)]">{district.housing_units_total ?? 0}</span> housing units approved</div>
                </div>
              )}
            </div>
          )}

          {rco && (
            <div className="border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-2">
                Registered Community Organization
              </div>
              <div className="text-base font-medium">{rco.name}</div>
              <div className="text-xs text-[var(--ink-dim)] mb-3">
                The RCO that gets formal notice of zoning changes here. Going to them first is how
                most organizing on a project starts.
              </div>
              <div className="text-xs space-y-1.5">
                {rco.primary_name && <div className="text-[var(--ink-dim)]">Contact: {rco.primary_name}</div>}
                {rco.primary_email && <div><a href={`mailto:${rco.primary_email}`} className="underline underline-offset-2 hover:text-[var(--ink)]">{rco.primary_email}</a></div>}
                {rco.primary_phone && <div className="text-[var(--ink-dim)]">{rco.primary_phone}</div>}
                {rco.website && <div><a href={rco.website} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)] break-all">{rco.website}</a></div>}
                {rco.meeting_info && <div className="text-[var(--ink-dim)]">Meets: {rco.meeting_info}</div>}
              </div>
            </div>
          )}

          {tract && (
            <div className="border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
              <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-2">
                Neighborhood context (census tract {tract.geoid.slice(-6)})
              </div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {tract.median_hh_income != null && (
                  <Stat label="Median income" value={`$${tract.median_hh_income.toLocaleString()}`} />
                )}
                {tract.pct_renter != null && (
                  <Stat label="Renter occupied" value={`${tract.pct_renter}%`} />
                )}
                {tract.pct_rent_burdened != null && (
                  <Stat label="Rent burdened" value={`${tract.pct_rent_burdened}%`} sub="(of renters, 30%+ of income)" />
                )}
                {tract.total_pop != null && (
                  <Stat label="Population" value={tract.total_pop.toLocaleString()} />
                )}
              </div>
              <div className="mt-3 text-[10px] text-[var(--ink-dim)]">
                ACS 5-year {tract.acs_year}
              </div>
            </div>
          )}
        </section>

        {/* Sibling projects within 400m. */}
        {siblings.length > 0 && (
          <section className="mt-10">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-lg font-medium">Nearby projects</h2>
              <span className="text-xs text-[var(--ink-dim)]">within 400m walk</span>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {siblings.map((s) => (
                <Link key={s.id} href={`/projects/${s.id}`} className="block border border-[var(--line)] rounded-lg p-3 bg-[var(--panel)] hover:bg-[var(--panel-2)] transition-colors">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[s.project_type] }} />
                    <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">
                      {TYPE_LABELS[s.project_type]} · {STATUS_LABELS[s.status]}
                    </span>
                  </div>
                  <div className="text-sm font-medium leading-snug">{s.name}</div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Demolition pressure within 400m. */}
        {demolitions.length > 0 && (
          <section className="mt-10">
            <div className="flex items-end justify-between mb-2">
              <h2 className="text-lg font-medium">Displacement signal</h2>
              <span className="text-xs text-[var(--ink-dim)]">L&I demolition permits, last 3 yrs, within 400m</span>
            </div>
            <p className="text-xs text-[var(--ink-dim)] mb-4">
              Philly doesn't publish eviction filings, so this uses demolition permits as the closest proxy
              for housing stock loss in the immediate area. {demolitions.length} permit{demolitions.length === 1 ? "" : "s"} found.
            </p>
            <div className="text-xs grid grid-cols-1 gap-1 max-h-56 overflow-y-auto border border-[var(--line)] rounded-lg p-3 bg-[var(--panel)]">
              {demolitions.slice(0, 12).map((d) => (
                <div key={d.id} className="flex justify-between gap-3">
                  <span className="text-[var(--ink)] truncate">{d.address || "—"}</span>
                  <span className="text-[var(--ink-dim)] whitespace-nowrap">{d.event_date}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {ds && (
          <section className="mt-10 border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
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
          </section>
        )}
      </div>
    </div>
  );
}

function Field({ label, value, href }: { label: string; value: string | null | undefined; href?: string }) {
  if (!value) return null;
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1">{label}</dt>
      <dd className="text-[var(--ink)]">
        {href ? <Link href={href} className="underline underline-offset-2 hover:opacity-80">{value}</Link> : value}
      </dd>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-0.5">{label}</div>
      <div className="text-[var(--ink)] font-medium">{value}</div>
      {sub && <div className="text-[9px] text-[var(--ink-dim)] mt-0.5">{sub}</div>}
    </div>
  );
}
