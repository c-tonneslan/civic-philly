import Link from "next/link";
import { getWeekHeadlines } from "@/lib/digest";
import { TYPE_COLORS, TYPE_LABELS, STATUS_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "This week in Philly · civic-philly",
  description: "What's new in Philadelphia's housing, transit, zoning, and infrastructure pipeline over the last 7 days.",
};

export default async function ThisWeek() {
  const h = await getWeekHeadlines(7).catch(() => null);
  if (!h) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-sm text-[var(--ink-dim)]">Couldn't load this week's data.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <header className="border-b border-[var(--line)] pb-6">
          <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
            civic-philly
          </Link>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">This week in Philly</h1>
          <p className="mt-2 text-[var(--ink-dim)]">
            Everything new in the city's housing, transit, zoning, and infrastructure pipeline
            over the last 7 days.
          </p>
        </header>

        <section className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat label="New projects" value={h.total_new} />
          <Stat label="Status changes" value={h.status_changes} />
          <Stat label="Demolitions" value={h.new_demolitions} />
          <Stat label="Code violations" value={h.new_violations} />
        </section>

        {h.big_projects.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-medium mb-3">Biggest projects added this week</h2>
            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
              {h.big_projects.map((p) => (
                <Link key={p.id} href={`/projects/${p.id}`}
                      className="block px-4 py-3 hover:bg-[var(--panel-2)] transition-colors">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[p.project_type as keyof typeof TYPE_COLORS] }} />
                        <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">
                          {TYPE_LABELS[p.project_type as keyof typeof TYPE_LABELS]} · {STATUS_LABELS[p.status as keyof typeof STATUS_LABELS]}
                        </span>
                        {p.council_district_id && (
                          <Link href={`/districts/${p.council_district_id}`} className="text-[10px] text-[var(--ink-dim)] underline-offset-2 hover:underline">
                            D{p.council_district_id}
                          </Link>
                        )}
                      </div>
                      <div className="text-sm font-medium">{p.name}</div>
                    </div>
                    <div className="text-xs text-right text-[var(--ink-dim)]">
                      {p.funding_amount != null && <div>${(p.funding_amount / 1_000_000).toFixed(1)}M</div>}
                      {p.units_total != null && p.units_total > 0 && <div>{p.units_total} units</div>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {h.per_district.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-medium mb-3">Activity by district</h2>
            <div className="space-y-1.5">
              {h.per_district.map((d) => {
                const max = Math.max(...h.per_district.map((x) => x.n));
                const pct = (d.n / max) * 100;
                return (
                  <Link key={d.district_id} href={`/districts/${d.district_id}`}
                        className="block text-xs hover:bg-[var(--panel-2)] rounded px-2 py-1.5 transition-colors">
                    <div className="flex justify-between text-[var(--ink-dim)] mb-1">
                      <span>District {d.district_id}</span>
                      <span>{d.n} new</span>
                    </div>
                    <div className="h-1.5 bg-[var(--panel-2)] rounded">
                      <div className="h-full bg-[var(--ink)] rounded" style={{ width: `${pct}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          </section>
        )}

        {h.top_developers.length > 0 && (
          <section className="mt-10">
            <h2 className="text-lg font-medium mb-3">Most-active applicants this week</h2>
            <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
              {h.top_developers.slice(0, 8).map((d) => (
                <Link key={d.developer} href={`/developers/${encodeURIComponent(d.developer)}`}
                      className="block px-4 py-2.5 hover:bg-[var(--panel-2)] transition-colors flex items-center justify-between">
                  <span className="text-sm">{d.developer}</span>
                  <span className="text-xs text-[var(--ink-dim)]">{d.n}</span>
                </Link>
              ))}
            </div>
          </section>
        )}

        {h.stalled_count > 0 && (
          <section className="mt-10 border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
            <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-2">Accountability</div>
            <div className="text-base font-medium">{h.stalled_count.toLocaleString()} projects stalled in proposed or approved for over a year</div>
            <div className="text-xs text-[var(--ink-dim)] mt-1 mb-3">
              Projects the city has announced but not delivered.
            </div>
            <Link href="/stalled" className="text-xs underline-offset-2 hover:underline">
              See the full list &rarr;
            </Link>
          </section>
        )}

        <footer className="mt-12 pt-6 border-t border-[var(--line)] text-xs text-[var(--ink-dim)] space-y-2">
          <div>
            <Link href="/" className="underline-offset-2 hover:underline">Open the map</Link>
            <span className="px-2">·</span>
            <Link href="/methodology" className="underline-offset-2 hover:underline">Methodology</Link>
            <span className="px-2">·</span>
            <Link href="/alerts" className="underline-offset-2 hover:underline">Get email alerts</Link>
            <span className="px-2">·</span>
            <a href="/feed.xml" className="underline-offset-2 hover:underline">RSS</a>
          </div>
        </footer>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1">{label}</div>
      <div className="text-2xl font-medium text-[var(--ink)]">{value.toLocaleString()}</div>
    </div>
  );
}
