import Link from "next/link";

export default function Error() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight">That link didn't work.</h1>
        <p className="mt-3 text-[var(--ink-dim)]">
          It might have expired or already been used. Try signing up again.
        </p>
        <Link href="/alerts" className="inline-block mt-6 px-4 py-2 text-sm rounded bg-[var(--ink)] text-[var(--bg)]">
          Sign up again
        </Link>
      </div>
    </div>
  );
}
