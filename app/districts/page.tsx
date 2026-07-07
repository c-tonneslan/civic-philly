import Link from "next/link";
import { getDistrictStats } from "@/lib/context";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Council districts · civic-philly",
  description: "Development activity, stalled projects, and investment across Philadelphia's 10 City Council districts.",
};

export default async function DistrictsIndex() {
  const stats = await getDistrictStats().catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">City council districts</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          Per-district aggregations: projects in the pipeline, housing units approved, capital dollars
          flowing in. Use these as starting briefs.
        </p>

        <div className="mt-8 grid sm:grid-cols-2 gap-4">
          {stats.map((d) => (
            <Link key={d.district_id} href={`/districts/${d.district_id}`}
                  className="block border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)] hover:bg-[var(--panel-2)] transition-colors">
              <div className="text-lg font-medium">District {d.district_id}</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                <Stat label="Total projects" value={d.total_projects.toLocaleString()} />
                <Stat label="Active" value={d.active_projects.toLocaleString()} />
                <Stat label="Housing units (total)" value={d.housing_units_total != null ? d.housing_units_total.toLocaleString() : "—"} />
                <Stat label="Capital funding" value={d.total_funding_amount != null ? `$${(Number(d.total_funding_amount)/1_000_000).toFixed(1)}M` : "—"} />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-0.5">{label}</div>
      <div className="text-[var(--ink)] font-medium">{value}</div>
    </div>
  );
}
