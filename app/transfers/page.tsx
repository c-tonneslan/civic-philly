import Link from "next/link";
import { getTopBuyers } from "@/lib/transfers";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Top buyers · civic-philly",
  description: "Who's actually buying Philadelphia property right now. Recent deed transfers ranked by buyer.",
};

export default async function TransfersPage() {
  const buyers = await getTopBuyers(12, 100).catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Top buyers (last 12 months)</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          Who's actually buying Philadelphia property. Aggregated from the RTT (realty transfer
          tax) feed: deeds, miscellaneous deeds, and sheriff's deeds with non-nominal consideration.
          Same names sometimes appear under slightly different spellings (we don't normalize beyond
          trimming whitespace).
        </p>

        <div className="mt-8 divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
          {buyers.map((b, i) => (
            <div key={b.grantee} className="px-4 py-3 hover:bg-[var(--panel-2)] transition-colors flex items-center justify-between gap-4 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-[10px] text-[var(--ink-dim)] font-mono">{String(i + 1).padStart(3, "0")}</span>
                  <span className="text-sm font-medium truncate">{b.grantee}</span>
                </div>
                <div className="text-[11px] text-[var(--ink-dim)]">
                  {b.districts.length > 0 && <span>districts {b.districts.join(", ")}</span>}
                </div>
              </div>
              <div className="text-right text-xs">
                <div className="text-[var(--ink)] font-medium">{b.n_purchases} purchases</div>
                <div className="text-[var(--ink-dim)]">
                  ${(b.total_consideration / 1_000_000).toFixed(2)}M
                </div>
              </div>
            </div>
          ))}
          {buyers.length === 0 && (
            <div className="p-6 text-sm text-[var(--ink-dim)]">No transfers loaded yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
