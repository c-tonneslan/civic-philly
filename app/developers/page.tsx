import Link from "next/link";
import { listTopDevelopers } from "@/lib/developers";

export const dynamic = "force-dynamic";

export default async function DevelopersPage() {
  const devs = await listTopDevelopers(100).catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Top developers and applicants</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          Whoever's name appears on the most affordable-housing applications or zoning permits.
          For housing: the developer of record. For zoning: the contractor or law firm pulling the permit
          (often the same firm shows up across many sites). Track who's actually building Philadelphia.
        </p>

        <div className="mt-8 divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
          {devs.map((d, i) => (
            <Link
              key={d.developer}
              href={`/developers/${encodeURIComponent(d.developer)}`}
              className="block px-4 py-3 hover:bg-[var(--panel-2)] transition-colors"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-[var(--ink-dim)] font-mono">{String(i + 1).padStart(3, "0")}</span>
                    <span className="text-sm font-medium truncate">{d.developer}</span>
                  </div>
                  <div className="text-[11px] text-[var(--ink-dim)]">
                    {d.housing > 0 && <span>{d.housing} housing</span>}
                    {d.housing > 0 && d.zoning > 0 && <span> · </span>}
                    {d.zoning > 0 && <span>{d.zoning} zoning</span>}
                    {d.units_total != null && d.units_total > 0 && <span> · {d.units_total.toLocaleString()} units</span>}
                    {d.districts.length > 0 && <span> · districts {d.districts.join(", ")}</span>}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-[var(--ink)] font-medium">{d.total}</div>
                  <div className="text-[var(--ink-dim)]">projects</div>
                </div>
              </div>
            </Link>
          ))}
          {devs.length === 0 && (
            <div className="p-6 text-sm text-[var(--ink-dim)]">No developers on file yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
