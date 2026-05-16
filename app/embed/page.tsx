import { listMapProjects } from "@/lib/projects";
import { parseFiltersFromSearchParams } from "@/lib/filterParams";
import MapView from "@/components/MapView";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "civic-philly · embed",
  robots: { index: false },
};

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

// Embed mode: just the map, no sidebar, no chrome. Drops into any
// iframe with filters via query string. Example:
//   <iframe src="https://civic-philly.vercel.app/embed?type=housing&status=under_construction" />
export default async function EmbedPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  const filters = parseFiltersFromSearchParams(toUrlSearchParams(sp));
  const points = await listMapProjects(filters).catch(() => []);

  return (
    <div className="fixed inset-0">
      <MapView points={points} filters={filters} />
      <a
        href={`/?${toUrlSearchParams(sp).toString()}`}
        target="_blank"
        rel="noreferrer"
        className="absolute bottom-4 left-4 text-[10px] text-[var(--ink-dim)] bg-[var(--panel)]/90 backdrop-blur border border-[var(--line)] rounded px-2 py-1 hover:text-[var(--ink)]"
      >
        Open full view ↗
      </a>
    </div>
  );
}
