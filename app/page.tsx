import { Suspense } from "react";
import Link from "next/link";
import { listMapProjects, listNeighborhoods, listFundingSources, listProjects } from "@/lib/projects";
import { parseFiltersFromSearchParams } from "@/lib/filterParams";
import Sidebar from "@/components/Sidebar";
import MapView from "@/components/MapView";

export const dynamic = "force-dynamic";

type SP = { [key: string]: string | string[] | undefined };

function toUrlSearchParams(sp: SP): URLSearchParams {
  const out = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    if (v == null) continue;
    if (Array.isArray(v)) v.forEach((x) => out.append(k, x));
    else out.append(k, v);
  }
  return out;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromSearchParams(toUrlSearchParams(sp));

  const [points, projects, neighborhoods, fundingSources] = await Promise.all([
    listMapProjects(filters).catch(() => []),
    listProjects(filters, 30, 0).catch(() => []),
    listNeighborhoods().catch(() => []),
    listFundingSources().catch(() => []),
  ]);

  return (
    <div className="w-screen h-screen overflow-hidden">
      <aside className="fixed top-0 left-0 bottom-0 w-[380px] border-r border-[var(--line)] bg-[var(--panel)] flex flex-col z-10">
        <header className="px-5 py-4 border-b border-[var(--line)] flex items-center justify-between">
          <div>
            <Link href="/" className="text-lg font-semibold tracking-tight">civic-philly</Link>
            <p className="text-xs text-[var(--ink-dim)] mt-0.5">what's being built in your neighborhood</p>
          </div>
          <Link href="/data" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
            data quality
          </Link>
        </header>
        <Suspense fallback={<div className="p-5 text-sm text-[var(--ink-dim)]">loading…</div>}>
          <Sidebar
            projects={projects}
            neighborhoods={neighborhoods}
            fundingSources={fundingSources}
            activeFilters={filters}
            initialQuery={sp}
          />
        </Suspense>
      </aside>
      <main className="fixed top-0 right-0 bottom-0 left-[380px]">
        <MapView points={points} filters={filters} />
      </main>
    </div>
  );
}
