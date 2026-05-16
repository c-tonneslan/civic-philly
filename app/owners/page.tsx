import Link from "next/link";
import { listTopOwners } from "@/lib/owners";

export const dynamic = "force-dynamic";

export default async function OwnersPage() {
  const owners = await listTopOwners(100).catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Property owners</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          Who actually owns the parcels behind these projects? Linked via OPA account number.
          Useful for catching the same LLC or principal showing up across multiple sites and
          districts. Counts include only parcels that appear in our project pipeline (zoning permits
          with a recorded OPA account number).
        </p>

        <div className="mt-8 divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
          {owners.map((o, i) => (
            <Link
              key={o.owner}
              href={`/owners/${encodeURIComponent(o.owner)}`}
              className="block px-4 py-3 hover:bg-[var(--panel-2)] transition-colors"
            >
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[10px] text-[var(--ink-dim)] font-mono">{String(i + 1).padStart(3, "0")}</span>
                    <span className="text-sm font-medium truncate">{o.owner}</span>
                  </div>
                  <div className="text-[11px] text-[var(--ink-dim)]">
                    {o.project_count} project{o.project_count === 1 ? "" : "s"}
                    {o.districts.length > 0 && <span> · districts {o.districts.join(", ")}</span>}
                    {o.total_market_value != null && <span> · ${(o.total_market_value / 1_000_000).toFixed(1)}M assessed</span>}
                  </div>
                </div>
                <div className="text-right text-xs">
                  <div className="text-[var(--ink)] font-medium">{o.total_parcels}</div>
                  <div className="text-[var(--ink-dim)]">parcels</div>
                </div>
              </div>
            </Link>
          ))}
          {owners.length === 0 && (
            <div className="p-6 text-sm text-[var(--ink-dim)]">No owner data loaded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
