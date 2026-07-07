import Link from "next/link";
import { getCitywideCohorts } from "@/lib/scorecard";
import DeliveryBar, { DeliveryLegend } from "@/components/DeliveryBar";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Delivery scorecard · civic-philly",
  description: "Of the Philadelphia projects proposed or approved each year, what share actually reached construction — the accountability thesis, quantified by vintage.",
};

export default async function ScorecardPage() {
  const cohorts = await getCitywideCohorts().catch(() => []);
  const ordered = [...cohorts].sort((a, b) => b.vintage - a.vintage);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>

        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Delivery scorecard</h1>
        <p className="mt-3 text-[var(--ink-dim)] max-w-2xl leading-relaxed">
          Of the projects first proposed or approved in a given year, what share actually reached
          construction — and what share stalled, was cancelled, or is still in the pipeline. Grouped
          by <span className="text-[var(--ink)]">vintage</span> (the year a project first appears
          with an approval or start date, falling back to when we first saw it).
        </p>

        <div className="mt-6 rounded-lg border border-[var(--line)] bg-[var(--panel)] p-4 text-[13px] text-[var(--ink-dim)] leading-relaxed">
          <div className="text-[10px] uppercase tracking-wider mb-2">How to read this</div>
          Recent vintages haven&apos;t had time to deliver, so any year within the last three
          years is greyed and shows no rate. &quot;Stalled&quot; means proposed or approved for
          over a year with no movement. Cancellations are under-counted — city feeds mostly publish
          active records. Most projects are dated by when we first saw them (few carry a real
          approval date), so recent vintages are inflated; the earliest predates full coverage.
        </div>

        <div className="mt-6">
          <DeliveryLegend />
        </div>

        <div className="mt-6 space-y-5">
          {ordered.map((row) => (
            <DeliveryBar key={row.vintage} row={row} />
          ))}
          {ordered.length === 0 && (
            <div className="text-sm text-[var(--ink-dim)]">No vintage data available.</div>
          )}
        </div>
      </div>
    </div>
  );
}
