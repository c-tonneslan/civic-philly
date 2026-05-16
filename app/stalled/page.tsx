import Link from "next/link";
import { getStalledProjects } from "@/lib/context";
import { TYPE_COLORS, TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function StalledPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const sp = await searchParams;
  const days = sp.days ? parseInt(sp.days, 10) : 365;
  const rows = await getStalledProjects(days, 300).catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Stalled projects</h1>
            <p className="mt-2 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
              Approved or proposed for more than {days} days and never moved on.
              Capital announced but not delivered. The accountability tracker.
            </p>
          </div>
          <div className="flex gap-2 text-xs">
            {[180, 365, 730].map((d) => (
              <Link key={d} href={`/stalled?days=${d}`}
                    className={`px-3 py-1.5 rounded border ${days === d ? "border-[var(--ink)] text-[var(--ink)]" : "border-[var(--line)] text-[var(--ink-dim)]"} hover:bg-[var(--panel-2)]`}>
                {d} days
              </Link>
            ))}
          </div>
        </div>

        <div className="mt-8 divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
          {rows.map((r) => (
            <Link key={r.id} href={`/projects/${r.id}`}
                  className="block px-4 py-3 hover:bg-[var(--panel-2)] transition-colors">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[r.project_type as keyof typeof TYPE_COLORS] || "#999" }} />
                    <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">
                      {TYPE_LABELS[r.project_type as keyof typeof TYPE_LABELS] || r.project_type} · {r.status}
                    </span>
                    {r.council_district_id && (
                      <Link href={`/districts/${r.council_district_id}`} className="text-[10px] text-[var(--ink-dim)] underline-offset-2 hover:underline">
                        District {r.council_district_id}
                      </Link>
                    )}
                  </div>
                  <div className="text-sm font-medium">{r.name}</div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-[var(--ink)] font-medium">{r.days_in_status} days</div>
                  <div className="text-[var(--ink-dim)]">stuck in &quot;{r.status}&quot;</div>
                </div>
              </div>
            </Link>
          ))}
          {rows.length === 0 && (
            <div className="p-6 text-sm text-[var(--ink-dim)]">
              No stalled projects at this threshold. (This view also depends on status history,
              which the scrape pipeline started collecting on this run, so older stalls will
              accumulate over the coming weeks.)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
