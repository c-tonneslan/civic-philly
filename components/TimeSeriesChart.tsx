import { TYPE_COLORS, TYPE_LABELS, type ProjectType } from "@/lib/types";

interface Bucket {
  year: number;
  housing: number;
  transit: number;
  zoning: number;
  infrastructure: number;
}

const TYPES: ProjectType[] = ["housing", "transit", "zoning", "infrastructure"];

// Stacked bar chart in plain SVG. No chart lib needed.
export default function TimeSeriesChart({ buckets }: { buckets: Bucket[] }) {
  if (buckets.length === 0) {
    return (
      <div className="text-sm text-[var(--ink-dim)] py-6">
        No activity yet at this scope, or no dated records to chart.
      </div>
    );
  }

  const maxTotal = Math.max(
    ...buckets.map((b) => b.housing + b.transit + b.zoning + b.infrastructure),
  );
  const padding = { top: 20, right: 20, bottom: 30, left: 36 };
  const innerW = 600;
  const innerH = 220;
  const w = innerW + padding.left + padding.right;
  const h = innerH + padding.top + padding.bottom;

  const xStep = innerW / buckets.length;
  const barW = Math.max(8, xStep * 0.7);

  function scaleY(v: number) {
    return innerH - (v / maxTotal) * innerH;
  }
  function tickValues(): number[] {
    const out = [];
    const step = Math.ceil(maxTotal / 4 / 10) * 10 || 1;
    for (let v = 0; v <= maxTotal + step; v += step) out.push(v);
    return out;
  }

  return (
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto block">
        {/* Y gridlines + labels */}
        {tickValues().map((v) => (
          <g key={v}>
            <line
              x1={padding.left} x2={padding.left + innerW}
              y1={padding.top + scaleY(v)} y2={padding.top + scaleY(v)}
              stroke="rgba(255,255,255,0.06)"
            />
            <text
              x={padding.left - 6} y={padding.top + scaleY(v) + 4}
              fill="var(--ink-dim)" fontSize="10" textAnchor="end"
            >{v}</text>
          </g>
        ))}

        {buckets.map((b, i) => {
          let yOffset = 0;
          const x = padding.left + i * xStep + (xStep - barW) / 2;
          return (
            <g key={b.year}>
              {TYPES.map((t) => {
                const v = b[t];
                if (v === 0) return null;
                const segH = (v / maxTotal) * innerH;
                const y = padding.top + innerH - yOffset - segH;
                yOffset += segH;
                return (
                  <rect
                    key={t}
                    x={x} y={y} width={barW} height={segH}
                    fill={TYPE_COLORS[t]}
                    rx={1}
                  >
                    <title>{`${b.year} · ${TYPE_LABELS[t]}: ${v}`}</title>
                  </rect>
                );
              })}
              <text
                x={x + barW / 2} y={h - padding.bottom + 14}
                fill="var(--ink-dim)" fontSize="10" textAnchor="middle"
              >{b.year}</text>
            </g>
          );
        })}
      </svg>

      <div className="flex flex-wrap gap-3 text-[11px] text-[var(--ink-dim)] mt-2">
        {TYPES.map((t) => (
          <span key={t} className="inline-flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
            {TYPE_LABELS[t]}
          </span>
        ))}
      </div>
    </div>
  );
}
