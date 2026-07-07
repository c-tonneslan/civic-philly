import Link from "next/link";
import { getDpiRanked } from "@/lib/displacement";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Displacement pressure · civic-philly",
  description: "A per-tract index combining housing-code violations, demolition permits, speculative flips, and rent burden — Philadelphia's displacement hotspots, ranked.",
};

function pct(v: number | null): string {
  return v == null ? "—" : `${Math.round(v * 100)}`;
}

export default async function DisplacementPage() {
  const rows = await getDpiRanked(60).catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Displacement pressure</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          A 0–100 index ranking census tracts by four present-pressure signals — housing-code
          violations, demolition permits, speculative flips (same address sold twice), and the
          rent-burdened share of households. Each component is a citywide percentile, so the
          score is a <span className="text-[var(--ink)]">relative</span> ranking, not an absolute
          measure. It reflects present pressure, not a longitudinal gentrification trajectory —
          see the <Link href="/methodology" className="underline underline-offset-2 hover:text-[var(--ink)]">methodology</Link> for windows and caveats.
        </p>

        <div className="mt-8 divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
          {rows.map((r, i) => (
            <Link
              key={r.geoid}
              href={`/?ov=displacement_pressure&c=${r.centroid_lng},${r.centroid_lat},14&layers=demo,viol`}
              className="block px-4 py-3 hover:bg-[var(--panel-2)] transition-colors"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] text-[var(--ink-dim)] font-mono">{String(i + 1).padStart(2, "0")}</span>
                    <span className="text-sm font-medium">Tract {r.geoid.slice(-6)}</span>
                  </div>
                  {/* Raw counts + percentiles so a rent-burden-carried tract reads as such. */}
                  <div className="text-[11px] text-[var(--ink-dim)] flex flex-wrap gap-x-3 gap-y-0.5">
                    <span>{r.n_viol} violations <span className="opacity-60">(p{pct(r.pr_viol)})</span></span>
                    <span>{r.n_demo} demolitions <span className="opacity-60">(p{pct(r.pr_demo)})</span></span>
                    <span>{r.n_flip} flips <span className="opacity-60">(p{pct(r.pr_flip)})</span></span>
                    <span>{r.pct_rent_burdened == null ? "rent burden n/a" : `${Math.round(r.pct_rent_burdened)}% rent-burdened`} <span className="opacity-60">(p{pct(r.pr_burden)})</span></span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-2xl font-semibold text-[var(--accent)] tabular-nums">{Math.round(r.dpi)}</div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">index</div>
                </div>
              </div>
            </Link>
          ))}
          {rows.length === 0 && (
            <div className="p-6 text-sm text-[var(--ink-dim)]">
              The displacement index isn&apos;t built yet on this deployment. It requires the
              violations, demolitions, transfers, and census loaders plus a materialized-view
              refresh (scripts/build-dpi.mjs).
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
