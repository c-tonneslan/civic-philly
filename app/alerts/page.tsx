import Link from "next/link";
import AlertForm from "@/components/AlertForm";

export const metadata = { title: "Email alerts — civic-philly" };

export default function AlertsPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Get an alert when something lands nearby</h1>
        <p className="mt-3 text-[var(--ink-dim)] leading-relaxed">
          Save an address and a radius. When new projects show up in the city feeds within that radius,
          you get an email. No account, no password. You can unsubscribe from any email.
        </p>

        <div className="mt-8 border border-[var(--line)] rounded-lg p-5 bg-[var(--panel)]">
          <AlertForm />
        </div>

        <p className="mt-6 text-xs text-[var(--ink-dim)] leading-relaxed">
          We only use your email to send these alerts. We don't share it. The "first seen" timestamp on
          each project is when our scraper picked it up, not when the city published it. There's typically
          a 1-7 day lag depending on the feed (see <Link href="/data" className="underline">data quality</Link>).
        </p>
      </div>
    </div>
  );
}
