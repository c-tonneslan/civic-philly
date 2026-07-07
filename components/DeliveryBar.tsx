import type { CohortRow } from "@/lib/scorecard";
import { isMatureVintage } from "@/lib/scorecard";

// A 100%-width stacked share bar for one vintage cohort. Plain divs (no chart
// lib), so it renders in a server component. Immature vintages are greyed and
// show no delivery rate — they haven't had time to deliver.
const SEGMENTS: { key: keyof CohortRow; label: string; color: string }[] = [
  { key: "completed", label: "Completed", color: "var(--ok)" },
  { key: "in_progress", label: "Under construction", color: "#4f8cc9" },
  { key: "active_pipeline", label: "In pipeline", color: "var(--panel-2)" },
  { key: "stalled", label: "Stalled (1yr+)", color: "var(--warn)" },
  { key: "cancelled", label: "Cancelled", color: "#5b616b" },
  { key: "unknown", label: "Unknown", color: "var(--line)" },
];

export default function DeliveryBar({ row }: { row: CohortRow }) {
  const mature = isMatureVintage(row.vintage);
  const reached = row.completed + row.in_progress;
  const rate = row.n > 0 ? Math.round((reached / row.n) * 100) : 0;

  return (
    <div className={mature ? "" : "opacity-55"}>
      <div className="flex items-baseline justify-between mb-1">
        <div className="flex items-baseline gap-2">
          <span className="text-sm font-medium tabular-nums">{row.vintage}</span>
          <span className="text-[11px] text-[var(--ink-dim)]">{row.n} project{row.n === 1 ? "" : "s"}</span>
          {!mature && <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">still maturing</span>}
        </div>
        {mature ? (
          <span className="text-xs text-[var(--ink-dim)]">
            <span className="text-[var(--ink)] font-medium tabular-nums">{rate}%</span> reached construction or beyond
          </span>
        ) : (
          <span className="text-xs text-[var(--ink-dim)]">—</span>
        )}
      </div>
      <div className="flex h-2.5 w-full overflow-hidden rounded bg-[var(--panel-2)]">
        {SEGMENTS.map((s) => {
          const v = row[s.key] as number;
          if (!v) return null;
          const wpct = (v / row.n) * 100;
          return (
            <div
              key={s.key}
              title={`${s.label}: ${v}`}
              style={{ width: `${wpct}%`, backgroundColor: s.color }}
            />
          );
        })}
      </div>
      {row.vintage_approx_n > 0 && (
        <div className="mt-1 text-[10px] text-[var(--ink-dim)]">
          {row.vintage_approx_n} dated by first-seen (no approval/start date on file)
        </div>
      )}
    </div>
  );
}

// Shared legend so the scorecard and district section read the same.
export function DeliveryLegend() {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-[var(--ink-dim)]">
      {SEGMENTS.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
          {s.label}
        </span>
      ))}
    </div>
  );
}
