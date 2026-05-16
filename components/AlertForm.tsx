"use client";

import { useState } from "react";
import type { ProjectType } from "@/lib/types";
import { PROJECT_TYPES, TYPE_COLORS, TYPE_LABELS } from "@/lib/types";

const GEOCODER_URL =
  process.env.NEXT_PUBLIC_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";

export default function AlertForm() {
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(800);
  const [types, setTypes] = useState<ProjectType[]>([...PROJECT_TYPES]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggleType(t: ProjectType) {
    setTypes((prev) => prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.includes("@")) return setErr("Enter a valid email.");
    if (!address.trim()) return setErr("Enter an address in Philadelphia.");
    if (types.length === 0) return setErr("Pick at least one project type.");
    setBusy(true);
    try {
      const q = `${address}, Philadelphia, PA`;
      const geo = await fetch(`${GEOCODER_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`, {
        headers: { "Accept-Language": "en" },
      });
      const arr = await geo.json();
      const hit = arr?.[0];
      if (!hit) { setErr("Couldn't find that address."); return; }

      const resp = await fetch("/api/alerts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          addressLabel: address,
          lat: Number(hit.lat),
          lng: Number(hit.lon),
          radiusMeters: radius,
          projectTypes: types,
        }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        setErr(j.error || "Something went wrong saving that subscription.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Network error. Try again in a moment.");
    } finally { setBusy(false); }
  }

  if (done) {
    return (
      <div className="text-sm">
        Almost there. Check your email at <span className="font-medium">{email}</span> for a confirmation
        link. The alert won't start until you click it.
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Field label="Email">
        <input
          type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Philadelphia address">
        <input
          type="text" required value={address} onChange={(e) => setAddress(e.target.value)}
          placeholder="4601 Market St"
          className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-3 py-2 text-sm"
        />
      </Field>
      <Field label="Alert radius">
        <select
          value={radius} onChange={(e) => setRadius(Number(e.target.value))}
          className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-3 py-2 text-sm"
        >
          <option value={400}>5 minute walk (400m)</option>
          <option value={800}>10 minute walk (800m)</option>
          <option value={1609}>1 mile</option>
          <option value={3219}>2 miles</option>
          <option value={5000}>5km</option>
        </select>
      </Field>
      <Field label="Project types">
        <div className="grid grid-cols-2 gap-1.5">
          {PROJECT_TYPES.map((t) => (
            <button
              key={t} type="button" onClick={() => toggleType(t)}
              className={`px-2.5 py-1.5 rounded text-xs flex items-center gap-2 border ${
                types.includes(t)
                  ? "bg-[var(--panel-2)] border-[var(--line)] text-[var(--ink)]"
                  : "bg-transparent border-[var(--line)] text-[var(--ink-dim)] hover:text-[var(--ink)]"
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
              {TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </Field>

      {err && <div className="text-xs text-red-400">{err}</div>}

      <button
        type="submit" disabled={busy}
        className="w-full py-2.5 rounded text-sm font-medium bg-[var(--ink)] text-[var(--bg)] disabled:opacity-50"
      >
        {busy ? "Saving…" : "Send me alerts"}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1.5">{label}</div>
      {children}
    </div>
  );
}
