import { Suspense } from "react";
import Link from "next/link";
import { listMapProjects, listNeighborhoods, listFundingSources, listProjects, countProjects } from "@/lib/projects";
import { parseFiltersFromSearchParams } from "@/lib/filterParams";
import { parseViewParams } from "@/lib/mapViewParams";
import Sidebar from "@/components/Sidebar";
import MapView from "@/components/MapView";
import MobileShell from "@/components/MobileShell";

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
  const urlParams = toUrlSearchParams(sp);
  const filters = parseFiltersFromSearchParams(urlParams);
  // View-state (camera/overlay/layers/selection) is parsed here too so the map
  // hydrates at the shared camera and the overlay <select>/Legend render correct
  // on first paint. These keys are NOT fed into the data queries below.
  const initialView = parseViewParams(urlParams);

  const [points, projects, totalCount, neighborhoods, fundingSources] = await Promise.all([
    listMapProjects(filters).catch(() => []),
    listProjects(filters, 30, 0).catch(() => []),
    countProjects(filters).catch(() => 0),
    listNeighborhoods().catch(() => []),
    listFundingSources().catch(() => []),
  ]);

  const sidebar = (
    <>
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
          totalCount={totalCount}
          aiEnabled={!!process.env.GROQ_API_KEY}
          neighborhoods={neighborhoods}
          fundingSources={fundingSources}
          activeFilters={filters}
          initialQuery={sp}
        />
      </Suspense>
    </>
  );

  return (
    <div className="w-screen overflow-hidden" style={{ height: "calc(100dvh - var(--nav-h))" }}>
      <MobileShell sidebar={sidebar}>
        <MapView points={points} filters={filters} initialView={initialView} />
      </MobileShell>
    </div>
  );
}
