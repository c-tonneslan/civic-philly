import Link from "next/link";
import { listDatasources } from "@/lib/datasources";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Data sources · civic-philly",
  description: "Every dataset behind civic-philly — where it comes from, when it last refreshed, and how many records it holds.",
};

export default async function DataPage() {
  const sources = await listDatasources().catch(() => []);

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Data quality notes</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          Every dataset on this map has gaps. Some are stale, some have inconsistent address geocoding,
          some are manually curated. Here's what we know about each feed so you can decide how much to trust it.
        </p>

        <div className="mt-8 space-y-6">
          {sources.map((ds) => (
            <div key={ds.id} className="border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-lg font-medium">{ds.name}</div>
                  <div className="text-xs text-[var(--ink-dim)] mt-0.5">{ds.agency}</div>
                </div>
                <StatusPill status={ds.status} />
              </div>

              {ds.description && (
                <p className="mt-3 text-sm text-[var(--ink)]/90">{ds.description}</p>
              )}

              {ds.quality_notes && (
                <div className="mt-4 p-3 rounded bg-[var(--panel-2)] border border-[var(--line)]">
                  <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1.5">
                    Known issues
                  </div>
                  <p className="text-[13px] leading-relaxed text-[var(--ink)]/85 whitespace-pre-line">
                    {ds.quality_notes}
                  </p>
                </div>
              )}

              <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[var(--ink-dim)]">
                <span>{ds.record_count.toLocaleString()} records</span>
                {ds.last_fetched_at && (
                  <span>Last refresh: {new Date(ds.last_fetched_at).toLocaleString()}</span>
                )}
                {ds.license && <span>License: {ds.license}</span>}
                {ds.homepage_url && (
                  <a href={ds.homepage_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-[var(--ink)]">
                    Source homepage
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>

        {sources.length === 0 && (
          <div className="mt-8 text-sm text-[var(--ink-dim)]">
            Run <code className="font-mono bg-[var(--panel-2)] px-1.5 py-0.5 rounded">npm run db:migrate</code> to seed the data source registry.
          </div>
        )}
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: "ok" | "degraded" | "down" }) {
  const cfg = {
    ok: { bg: "bg-green-500/15 border-green-500/40 text-green-300", label: "Healthy" },
    degraded: { bg: "bg-yellow-500/15 border-yellow-500/40 text-yellow-300", label: "Degraded" },
    down: { bg: "bg-red-500/15 border-red-500/40 text-red-300", label: "Failing" },
  }[status];
  return (
    <span className={`text-[10px] px-2 py-1 rounded border ${cfg.bg}`}>{cfg.label}</span>
  );
}
