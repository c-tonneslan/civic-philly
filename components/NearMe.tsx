"use client";

import { useState } from "react";
import AddressAutocomplete from "./AddressAutocomplete";

interface Props {
  active: { lat: number; lng: number; radiusMeters: number } | undefined;
  onApply: (n: { lat: number; lng: number; radiusMeters: number }) => void;
  onClear: () => void;
}

const GEOCODER_URL =
  process.env.NEXT_PUBLIC_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";

// Radius options matched to how people actually think about distance.
const RADIUS_OPTIONS = [
  { label: "5 min walk", meters: 400 },
  { label: "10 min walk", meters: 800 },
  { label: "1/2 mile", meters: 805 },
  { label: "1 mile", meters: 1609 },
  { label: "2 miles", meters: 3219 },
];

export default function NearMe({ active, onApply, onClear }: Props) {
  const [address, setAddress] = useState("");
  const [radius, setRadius] = useState(active?.radiusMeters ?? 800);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleApply(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim()) return;
    setBusy(true);
    setErr(null);
    try {
      const q = `${address}, Philadelphia, PA`;
      const url = `${GEOCODER_URL}?format=json&limit=1&q=${encodeURIComponent(q)}`;
      const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
      if (!resp.ok) throw new Error("geocoder error");
      const arr = await resp.json();
      const hit = arr?.[0];
      if (!hit) {
        setErr("Couldn't find that address. Try adding the cross street.");
        return;
      }
      onApply({ lat: Number(hit.lat), lng: Number(hit.lon), radiusMeters: radius });
    } catch {
      setErr("Geocoder request failed. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)] mb-1.5">
        What's near me
      </div>
      <form onSubmit={handleApply} className="flex gap-1.5">
        <div className="flex-1 min-w-0">
          <AddressAutocomplete
            value={address}
            onChange={setAddress}
            onSelect={(s) => onApply({ lat: s.lat, lng: s.lng, radiusMeters: radius })}
            placeholder="e.g. 4601 Market St"
            className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
          />
        </div>
        <select
          value={radius}
          onChange={(e) => setRadius(Number(e.target.value))}
          className="bg-[var(--panel-2)] border border-[var(--line)] rounded px-1.5 py-1.5 text-xs"
        >
          {RADIUS_OPTIONS.map((r) => (
            <option key={r.meters} value={r.meters}>{r.label}</option>
          ))}
        </select>
        <button
          type="submit"
          disabled={busy}
          className="px-2.5 py-1.5 rounded text-xs bg-[var(--ink)] text-[var(--bg)] disabled:opacity-50"
        >
          {busy ? "…" : "Go"}
        </button>
      </form>
      {err && <div className="text-[11px] text-red-400 mt-1">{err}</div>}
      {active && (
        <div className="text-[11px] text-[var(--ink-dim)] mt-1.5 flex items-center justify-between">
          <span>
            within {active.radiusMeters >= 1609 ? `${(active.radiusMeters / 1609).toFixed(1)} mi` : `${active.radiusMeters}m`}
          </span>
          <button onClick={onClear} className="underline-offset-2 hover:underline hover:text-[var(--ink)]">
            clear
          </button>
        </div>
      )}
    </div>
  );
}
