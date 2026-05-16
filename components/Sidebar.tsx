"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition, useState } from "react";
import type { Project, ProjectFilters, ProjectStatus, ProjectType } from "@/lib/types";
import {
  PROJECT_STATUSES, PROJECT_TYPES,
  STATUS_LABELS, TYPE_COLORS, TYPE_LABELS,
} from "@/lib/types";
import NearMe from "./NearMe";

interface Props {
  projects: Project[];
  neighborhoods: string[];
  fundingSources: string[];
  activeFilters: ProjectFilters;
  initialQuery: { [k: string]: string | string[] | undefined };
}

function buildQuery(filters: ProjectFilters): string {
  const sp = new URLSearchParams();
  filters.types?.forEach((t) => sp.append("type", t));
  filters.statuses?.forEach((s) => sp.append("status", s));
  if (filters.neighborhood) sp.set("neighborhood", filters.neighborhood);
  if (filters.fundingSource) sp.set("funding", filters.fundingSource);
  if (filters.districtId) sp.set("district", String(filters.districtId));
  if (filters.developer) sp.set("developer", filters.developer);
  if (filters.q) sp.set("q", filters.q);
  if (filters.startYear) sp.set("startYear", String(filters.startYear));
  if (filters.endYear) sp.set("endYear", String(filters.endYear));
  if (filters.near) {
    sp.set("lat", String(filters.near.lat));
    sp.set("lng", String(filters.near.lng));
    sp.set("radius", String(filters.near.radiusMeters));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export default function Sidebar({ projects, neighborhoods, fundingSources, activeFilters }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filters, setFilters] = useState<ProjectFilters>(activeFilters);

  function update(patch: Partial<ProjectFilters>) {
    const next = { ...filters, ...patch };
    setFilters(next);
    startTransition(() => { router.push(`/${buildQuery(next)}`, { scroll: false }); });
  }

  function toggleType(t: ProjectType) {
    const current = new Set(filters.types ?? PROJECT_TYPES);
    if (current.has(t)) current.delete(t); else current.add(t);
    const next = Array.from(current);
    update({ types: next.length === PROJECT_TYPES.length ? undefined : next });
  }

  function toggleStatus(s: ProjectStatus) {
    const current = new Set(filters.statuses ?? []);
    if (current.has(s)) current.delete(s); else current.add(s);
    update({ statuses: current.size ? Array.from(current) : undefined });
  }

  const activeTypes = new Set(filters.types ?? PROJECT_TYPES);
  const activeStatuses = new Set(filters.statuses ?? []);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-5 py-4 border-b border-[var(--line)] space-y-4">
        <SearchBox value={filters.q ?? ""} onChange={(q) => update({ q: q || undefined })} />
        <NearMe
          active={filters.near}
          onApply={(near) => update({ near })}
          onClear={() => update({ near: undefined })}
        />

        <div>
          <FieldLabel>Project type</FieldLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {PROJECT_TYPES.map((t) => (
              <button
                key={t}
                onClick={() => toggleType(t)}
                className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-2 border transition-colors ${
                  activeTypes.has(t)
                    ? "bg-[var(--panel-2)] border-[var(--line)] text-[var(--ink)]"
                    : "bg-transparent border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--ink)]"
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
                {TYPE_LABELS[t]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <FieldLabel>Status</FieldLabel>
          <div className="flex flex-wrap gap-1.5">
            {PROJECT_STATUSES.filter((s) => s !== "unknown").map((s) => (
              <button
                key={s}
                onClick={() => toggleStatus(s)}
                className={`px-2 py-1 rounded text-[11px] border ${
                  activeStatuses.has(s)
                    ? "bg-[var(--ink)] text-[var(--bg)] border-[var(--ink)]"
                    : "bg-transparent border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--ink)]"
                }`}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>Council district</FieldLabel>
            <select
              value={filters.districtId ?? ""}
              onChange={(e) => update({ districtId: e.target.value ? Number(e.target.value) : undefined })}
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
            >
              <option value="">Any</option>
              {[1,2,3,4,5,6,7,8,9,10].map((n) => <option key={n} value={n}>District {n}</option>)}
            </select>
          </div>
          <div>
            <FieldLabel>Neighborhood</FieldLabel>
            <select
              value={filters.neighborhood ?? ""}
              onChange={(e) => update({ neighborhood: e.target.value || undefined })}
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
            >
              <option value="">Any</option>
              {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
            </select>
          </div>
        </div>

        <div>
          <FieldLabel>Funding source</FieldLabel>
          <select
            value={filters.fundingSource ?? ""}
            onChange={(e) => update({ fundingSource: e.target.value || undefined })}
            className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
          >
            <option value="">Any</option>
            {fundingSources.slice(0, 50).map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <FieldLabel>From year</FieldLabel>
            <input
              type="number" min={2000} max={2040}
              value={filters.startYear ?? ""}
              onChange={(e) => update({ startYear: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="2020"
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
            />
          </div>
          <div>
            <FieldLabel>To year</FieldLabel>
            <input
              type="number" min={2000} max={2040}
              value={filters.endYear ?? ""}
              onChange={(e) => update({ endYear: e.target.value ? Number(e.target.value) : undefined })}
              placeholder="2030"
              className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-[11px] text-[var(--ink-dim)]">
            {pending ? "updating…" : `${projects.length} projects`}
          </span>
          <div className="flex items-center gap-3">
            <a
              href={`/api/export.csv${buildQuery(filters)}`}
              className="text-[11px] text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline"
            >
              export CSV
            </a>
            <button
              onClick={() => { setFilters({}); startTransition(() => router.push("/")); }}
              className="text-[11px] text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline"
            >
              reset
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 && (
          <div className="p-5 text-sm text-[var(--ink-dim)]">
            No projects match these filters. Try widening the date range or clearing the neighborhood.
          </div>
        )}
        {projects.map((p) => (
          <Link
            key={p.id}
            href={`/projects/${p.id}`}
            className="block px-5 py-3 border-b border-[var(--line)] hover:bg-[var(--panel-2)] transition-colors"
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[p.project_type] }} />
              <span className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">
                {TYPE_LABELS[p.project_type]} · {STATUS_LABELS[p.status]}
              </span>
            </div>
            <div className="text-sm font-medium leading-snug">{p.name}</div>
            <div className="text-xs text-[var(--ink-dim)] mt-1 flex gap-3">
              {p.neighborhood && <span>{p.neighborhood}</span>}
              {p.units_total != null && p.units_total > 0 && <span>{p.units_total} units</span>}
              {p.funding_amount != null && <span>${(p.funding_amount / 1_000_000).toFixed(1)}M</span>}
            </div>
          </Link>
        ))}
      </div>

      <footer className="px-5 py-3 border-t border-[var(--line)] flex items-center justify-between gap-2 text-[11px] text-[var(--ink-dim)] flex-wrap">
        <Link href="/this-week" className="hover:text-[var(--ink)] underline-offset-2 hover:underline">This week</Link>
        <Link href="/districts" className="hover:text-[var(--ink)] underline-offset-2 hover:underline">Districts</Link>
        <Link href="/developers" className="hover:text-[var(--ink)] underline-offset-2 hover:underline">Devs</Link>
        <Link href="/owners" className="hover:text-[var(--ink)] underline-offset-2 hover:underline">Owners</Link>
        <Link href="/stalled" className="hover:text-[var(--ink)] underline-offset-2 hover:underline">Stalled</Link>
        <Link href="/alerts" className="hover:text-[var(--ink)] underline-offset-2 hover:underline">Alerts</Link>
        <Link href="/methodology" className="hover:text-[var(--ink)] underline-offset-2 hover:underline">Methods</Link>
      </footer>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1.5">{children}</div>;
}

function SearchBox({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [draft, setDraft] = useState(value);
  // Don't fire on every keystroke; commit on enter or blur.
  return (
    <div>
      <FieldLabel>Search</FieldLabel>
      <input
        type="search"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") onChange(draft.trim()); }}
        onBlur={() => { if (draft.trim() !== value) onChange(draft.trim()); }}
        placeholder="name, address, developer..."
        className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
      />
    </div>
  );
}
