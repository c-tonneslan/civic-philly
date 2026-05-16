import { STATUS_LABELS, type ProjectStatus } from "@/lib/types";

interface Props {
  history: { status: string; observed_at: string }[];
}

export default function StatusTimeline({ history }: Props) {
  return (
    <section className="mt-10">
      <h2 className="text-lg font-medium mb-3">Status timeline</h2>
      <p className="text-xs text-[var(--ink-dim)] mb-4">
        Every time our scraper saw a status change. Promises vs delivery.
      </p>
      <ol className="relative border-l border-[var(--line)] ml-2">
        {history.map((h, i) => (
          <li key={i} className="ml-4 mb-3 last:mb-0">
            <span className="absolute -left-1.5 w-3 h-3 rounded-full bg-[var(--ink)] border border-[var(--panel)]" />
            <div className="text-sm text-[var(--ink)]">
              {STATUS_LABELS[h.status as ProjectStatus] || h.status}
            </div>
            <div className="text-[11px] text-[var(--ink-dim)]">
              {new Date(h.observed_at).toLocaleDateString()}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
