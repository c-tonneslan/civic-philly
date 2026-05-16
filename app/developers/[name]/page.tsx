import Link from "next/link";
import { notFound } from "next/navigation";
import { getDeveloper } from "@/lib/developers";
import { listProjects } from "@/lib/projects";
import { STATUS_LABELS, TYPE_COLORS, TYPE_LABELS } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function DeveloperPage({ params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const decoded = decodeURIComponent(name);

  const [dev, projects] = await Promise.all([
    getDeveloper(decoded),
    listProjects({ developer: decoded }, 100, 0).catch(() => []),
  ]);
  if (!dev) notFound();

  const csvUrl = `/api/export.csv?developer=${encodeURIComponent(decoded)}`;
  const mapUrl = `/?developer=${encodeURIComponent(decoded)}`;

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/developers" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; all developers
        </Link>

        <div className="mt-4 flex items-end justify-between flex-wrap gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{decoded}</h1>
          <div className="flex gap-2 text-xs">
            <Link href={mapUrl} className="px-3 py-1.5 rounded border border-[var(--line)] hover:bg-[var(--panel-2)]">View on map &rarr;</Link>
            <a href={csvUrl} className="px-3 py-1.5 rounded border border-[var(--line)] hover:bg-[var(--panel-2)]">Export CSV</a>
          </div>
        </div>

        <section className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Card label="Total" value={dev.total} />
          <Card label="Active" value={dev.active} />
          <Card label="Pipeline" value={dev.pipeline} />
          <Card label="Completed" value={dev.completed} />
          <Card label="Housing units" value={dev.units_total != null ? dev.units_total.toLocaleString() : "—"} />
          <Card label="Housing projects" value={dev.housing} />
          <Card label="Zoning permits" value={dev.zoning} />
          <Card label="Districts" value={dev.districts.join(", ") || "—"} small />
        </section>

        <section className="mt-10">
          <h2 className="text-lg font-medium mb-3">Projects</h2>
          <div className="divide-y divide-[var(--line)] border border-[var(--line)] rounded-lg overflow-hidden">
            {projects.map((p) => (
              <Link key={p.id} href={`/projects/${p.id}`} className="block px-4 py-3 hover:bg-[var(--panel-2)] transition-colors">
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[p.project_type] }} />
                  <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">
                    {TYPE_LABELS[p.project_type]} · {STATUS_LABELS[p.status]}
                  </span>
                </div>
                <div className="text-sm font-medium">{p.name}</div>
                {p.address && <div className="text-xs text-[var(--ink-dim)] mt-0.5">{p.address}</div>}
              </Link>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function Card({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1">{label}</div>
      <div className={`${small ? "text-sm" : "text-2xl"} font-medium text-[var(--ink)]`}>{value}</div>
    </div>
  );
}
