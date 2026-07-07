import Link from "next/link";
import type { ReactNode } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getOwnerSummary, getOwnerParcels } from "@/lib/owners";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ name: string }> }): Promise<Metadata> {
  const { name } = await params;
  const decoded = decodeURIComponent(name);
  const title = `${decoded} · civic-philly`;
  const description = `Parcels, assessed value, and council districts owned by ${decoded} in Philadelphia.`;
  return { title, description, openGraph: { title, description } };
}

export default async function OwnerPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  const [summary, parcels] = await Promise.all([
    getOwnerSummary(decoded),
    getOwnerParcels(decoded, 200),
  ]);
  if (!summary) notFound();

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/owners" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; all owners
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">{decoded}</h1>

        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card label="Parcels" value={summary.total_parcels.toLocaleString()} />
          <Card label="In project pipeline" value={summary.project_count.toLocaleString()} />
          <Card label="Assessed value" value={summary.total_market_value != null ? `$${(summary.total_market_value / 1_000_000).toFixed(1)}M` : "—"} />
          <Card
            label="Active districts"
            small
            value={
              summary.districts.length ? (
                <span className="flex flex-wrap gap-x-1.5">
                  {summary.districts.map((d, i) => (
                    <span key={d}>
                      <Link href={`/districts/${d}`} className="underline underline-offset-2 hover:text-[var(--accent)]">{d}</Link>
                      {i < summary.districts.length - 1 ? "," : ""}
                    </span>
                  ))}
                </span>
              ) : "—"
            }
          />
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium mb-3">All parcels owned by this name</h2>
          <p className="text-xs text-[var(--ink-dim)] mb-4">
            From the Office of Property Assessment. We match by OPA account number to project records, so a parcel
            in this list may not have an active project record.
          </p>
          <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
            {parcels.map((p) => {
              const inner = (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium flex items-center gap-2">
                      <span className="truncate">{p.location_address || `Parcel ${p.parcel_number}`}</span>
                      {p.project_id != null && (
                        <span className="shrink-0 t-eyebrow text-[var(--accent)]">in pipeline &rarr;</span>
                      )}
                    </div>
                    <div className="text-[11px] text-[var(--ink-dim)] mt-0.5">
                      OPA {p.parcel_number}
                      {p.mailing_address && <span> · mailing: {p.mailing_address}, {p.mailing_city_state} {p.mailing_zip}</span>}
                    </div>
                  </div>
                  <div className="text-xs text-right">
                    {p.market_value != null && (
                      <div className="text-[var(--ink)]">${p.market_value.toLocaleString()}</div>
                    )}
                  </div>
                </>
              );
              // A parcel that appears in the project pipeline links to its project;
              // the rest stay as static rows. Closes the owner -> project dead end.
              return p.project_id != null ? (
                <Link
                  key={p.parcel_number}
                  href={`/projects/${p.project_id}`}
                  className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap hover:bg-[var(--panel-2)] transition-colors"
                >
                  {inner}
                </Link>
              ) : (
                <div key={p.parcel_number} className="px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
                  {inner}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ label, value, small }: { label: string; value: ReactNode; small?: boolean }) {
  return (
    <div className="border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1">{label}</div>
      <div className={`${small ? "text-sm" : "text-2xl"} font-medium text-[var(--ink)]`}>{value}</div>
    </div>
  );
}
