import Link from "next/link";

export default function Confirmed() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">You're in.</h1>
        <p className="mt-3 text-[var(--ink-dim)]">
          We'll email you when new projects show up near your address. You can unsubscribe from any alert.
        </p>
        <Link href="/" className="inline-block mt-6 px-4 py-2 text-sm rounded bg-[var(--ink)] text-[var(--bg)]">
          Back to map
        </Link>
      </div>
    </div>
  );
}
