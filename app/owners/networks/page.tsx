import Link from "next/link";
import { getOwnerNetworks } from "@/lib/transfers";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Owner networks · civic-philly",
  description: "Mailing addresses with multiple LLCs registered to them: the shell-LLC pattern catcher.",
};

export default async function NetworksPage() {
  const networks = await getOwnerNetworks(80).catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/owners" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to owners
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Owner networks</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          Mailing addresses with multiple LLC names registered to them. When eight LLCs all send
          their tax bills to the same office, that's usually one beneficial owner running a portfolio
          under shell names. Ranked by number of distinct LLC names.
        </p>

        <div className="mt-8 space-y-4">
          {networks.map((n, i) => (
            <div key={i} className="border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
              <div className="flex justify-between items-start flex-wrap gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs uppercase tracking-wider text-[var(--ink-dim)] mb-1">
                    Mailing address
                  </div>
                  <div className="text-sm font-medium">
                    {n.mailing_address}
                    {n.mailing_city_state && <span className="text-[var(--ink-dim)]"> · {n.mailing_city_state}</span>}
                  </div>
                </div>
                <div className="text-right text-xs whitespace-nowrap">
                  <div className="text-[var(--ink)] font-medium">{n.owners.length} owners</div>
                  <div className="text-[var(--ink-dim)]">{n.parcel_count} parcels</div>
                  {n.total_market_value != null && (
                    <div className="text-[var(--ink-dim)]">${(n.total_market_value / 1_000_000).toFixed(1)}M</div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {n.owners.slice(0, 12).map((o) => (
                  <Link key={o} href={`/owners/${encodeURIComponent(o)}`}
                        className="text-[11px] px-2 py-0.5 bg-[var(--panel-2)] border border-[var(--line)] rounded hover:bg-[var(--bg)]">
                    {o}
                  </Link>
                ))}
                {n.owners.length > 12 && (
                  <span className="text-[11px] text-[var(--ink-dim)] px-2 py-0.5">
                    +{n.owners.length - 12} more
                  </span>
                )}
              </div>
            </div>
          ))}
          {networks.length === 0 && (
            <div className="text-sm text-[var(--ink-dim)] p-5">No multi-LLC mailing addresses found yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
