"use client";

import { useEffect, useRef, useState } from "react";

interface Suggestion {
  display_name: string;
  lat: string;
  lon: string;
}

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSelect?: (s: { lat: number; lng: number; label: string }) => void;
  placeholder?: string;
  className?: string;
}

const GEOCODER_URL =
  process.env.NEXT_PUBLIC_GEOCODER_URL || "https://nominatim.openstreetmap.org/search";

// Philadelphia bounding box (left,top,right,bottom). Pinned tight so
// "Market St" doesn't autocomplete to Market St in some other city.
const PHILLY_VIEWBOX = "-75.2803,40.1379,-74.9558,39.8670";

// Nominatim has a usage policy: 1 req/sec, real User-Agent. We debounce
// to 350ms and only fire on input >= 4 chars.
export default function AddressAutocomplete({
  value, onChange, onSelect, placeholder, className,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 4) {
      setSuggestions([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const q = `${value}, Philadelphia, PA`;
      const url = `${GEOCODER_URL}?format=json&limit=5&countrycodes=us&viewbox=${PHILLY_VIEWBOX}&bounded=1&q=${encodeURIComponent(q)}`;
      try {
        const resp = await fetch(url, { headers: { "Accept-Language": "en" } });
        if (!resp.ok) return;
        const arr = (await resp.json()) as Suggestion[];
        setSuggestions(Array.isArray(arr) ? arr : []);
      } catch {
        // Network failures are silent. The user can still hit enter to submit.
      }
    }, 350);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [value]);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function pick(s: Suggestion) {
    onChange(s.display_name.split(",").slice(0, 2).join(",").trim());
    onSelect?.({ lat: Number(s.lat), lng: Number(s.lon), label: s.display_name });
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className="relative">
      <input
        type="text"
        value={value}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        placeholder={placeholder}
        className={className}
        autoComplete="off"
      />
      {open && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 z-30 bg-[var(--panel)] border border-[var(--line)] rounded shadow-lg max-h-56 overflow-y-auto">
          {suggestions.map((s, i) => (
            <button
              type="button"
              key={i}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-[var(--panel-2)] border-b border-[var(--line)] last:border-b-0"
            >
              {s.display_name}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
