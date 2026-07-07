"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import type { MapProject } from "@/lib/projects";
import type { ProjectFilters, ProjectType } from "@/lib/types";
import { TYPE_COLORS, TYPE_LABELS, STATUS_LABELS } from "@/lib/types";
import { formatYMD } from "@/lib/dates";

interface Props {
  points: MapProject[];
  filters: ProjectFilters;
}

const PHL_CENTER: [number, number] = [-75.1652, 39.9526];
// Dark basemap to match the dark chrome (popups, legend, borders are all styled
// for dark). A light positron base made the whole app read as two designs.
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/dark";

// One sequential, single-hue (cyan) ramp for the choropleth. Chosen to be
// perceptually monotonic (varies mostly in luminance, so it survives color-vision
// deficiency) and distinct from the four categorical TYPE_COLORS (blue/orange/
// purple/green). The old ramp's top color was identical to the transit dot.
const CHORO = { lo: "#0a2e33", mid: "#0e7490", hi: "#38e0d0" };

const OVERLAY_OPTIONS = [
  { id: "none",          label: "None" },
  { id: "rent_burdened", label: "Rent burdened", scale: "pct" },
  { id: "renter",        label: "Renter occupied", scale: "pct" },
  { id: "income",        label: "Median income", scale: "income" },
  { id: "black",         label: "Black population", scale: "pct" },
  { id: "white",         label: "White population", scale: "pct" },
  { id: "hispanic",      label: "Hispanic population", scale: "pct" },
] as const;
type OverlayId = (typeof OVERLAY_OPTIONS)[number]["id"];

function overlayMeta(id: OverlayId) {
  return OVERLAY_OPTIONS.find((o) => o.id === id) ?? OVERLAY_OPTIONS[0];
}
function formatMetric(id: OverlayId, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const scale = (overlayMeta(id) as { scale?: string }).scale;
  if (scale === "income") return `$${Math.round(v).toLocaleString()}`;
  if (scale === "pct") return `${Math.round(v)}%`;
  return String(v);
}

export default function MapView({ points, filters }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [overlay, setOverlay] = useState<OverlayId>("none");
  const [ramp, setRamp] = useState<{ lo: number; hi: number } | null>(null);
  const [showDemolitions, setShowDemolitions] = useState(false);
  const [showViolations, setShowViolations] = useState(false);
  // The tract click handler is bound once on map load, so it can't close over
  // the latest `overlay`. Mirror it into a ref the handler reads at click time.
  const overlayRef = useRef<OverlayId>("none");
  overlayRef.current = overlay;

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        center: PHL_CENTER,
        zoom: 11.5,
        attributionControl: { compact: true },
      });
    } catch (e) {
      setError(`Map init failed: ${(e as Error).message}`);
      console.error("maplibre init error", e);
      return;
    }
    map.on("error", (e) => {
      console.error("maplibre runtime error", e);
      setError(`Map error: ${e.error?.message || "unknown"}`);
    });
    const forceResize = () => map.resize();
    window.addEventListener("resize", forceResize);
    requestAnimationFrame(forceResize);
    setTimeout(forceResize, 200);
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

    map.on("load", () => {
      // Choropleth source (empty until user picks a metric).
      map.addSource("tracts", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "tracts-fill", type: "fill", source: "tracts",
        paint: {
          "fill-color": ["interpolate", ["linear"], ["coalesce", ["get", "value"], 0],
            0, CHORO.lo, 100, CHORO.hi],
          "fill-opacity": 0.6,
        },
      }, /* beforeId */ undefined);
      map.addLayer({
        id: "tracts-line", type: "line", source: "tracts",
        paint: { "line-color": "rgba(255,255,255,0.14)", "line-width": 0.5 },
      });

      // Demolitions source.
      map.addSource("demolitions", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "demolitions-circles", type: "circle", source: "demolitions",
        paint: {
          "circle-color": "#d98a7b",
          "circle-radius": 4,
          "circle-opacity": 0.7,
          "circle-stroke-width": 1,
          "circle-stroke-color": "#0b0c0e",
        },
      });
      map.setLayoutProperty("demolitions-circles", "visibility", "none");

      // Violations source.
      map.addSource("violations", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "violations-circles", type: "circle", source: "violations",
        paint: {
          "circle-color": "#e0b64d",
          "circle-radius": 3,
          "circle-opacity": 0.55,
        },
      });
      map.setLayoutProperty("violations-circles", "visibility", "none");

      // Projects (clustered).
      map.addSource("projects", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });
      map.addLayer({
        id: "clusters", type: "circle", source: "projects",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#4b5563", 10, "#6b7280", 50, "#9ca3af"],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#e7ebef",
        },
      });
      map.addLayer({
        id: "cluster-count", type: "symbol", source: "projects",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
          "text-font": ["Noto Sans Bold"],
        },
        paint: { "text-color": "#0b0c0e" },
      });
      map.addLayer({
        id: "unclustered", type: "circle", source: "projects",
        filter: ["!", ["has", "point_count"]],
        paint: {
          "circle-color": [
            "match", ["get", "project_type"],
            "housing", TYPE_COLORS.housing,
            "transit", TYPE_COLORS.transit,
            "zoning", TYPE_COLORS.zoning,
            "infrastructure", TYPE_COLORS.infrastructure,
            "#9ca3af",
          ],
          "circle-radius": 7,
          "circle-stroke-width": 1.5,
          "circle-stroke-color": "#0b0c0e",
        },
      });

      map.on("click", "clusters", async (e) => {
        const features = map.queryRenderedFeatures(e.point, { layers: ["clusters"] });
        const clusterId = features[0]?.properties?.cluster_id;
        if (clusterId == null) return;
        const src = map.getSource("projects") as GeoJSONSource & {
          getClusterExpansionZoom: (id: number) => Promise<number>;
        };
        const zoom = await src.getClusterExpansionZoom(clusterId);
        const geom = features[0].geometry as unknown as { coordinates: [number, number] };
        map.easeTo({ center: geom.coordinates, zoom });
      });

      map.on("click", "unclustered", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as { id: number; name: string; project_type: ProjectType; status: string };
        const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
        const label = TYPE_LABELS[props.project_type] || "Project";
        const status = STATUS_LABELS[props.status as keyof typeof STATUS_LABELS] || props.status;
        const html = `
          <div class="text-sm leading-snug">
            <div class="text-[10px] uppercase tracking-wider opacity-60">${label} · ${status}</div>
            <div class="font-medium mt-1 mb-2">${escapeHtml(props.name)}</div>
            <a href="/projects/${props.id}" class="text-xs underline underline-offset-2 hover:opacity-80">Open details &rarr;</a>
          </div>`;
        new maplibregl.Popup({ closeButton: true, offset: 14 })
          .setLngLat(coords).setHTML(html).addTo(map);
      });

      // Tract popup: name the active metric and format its value ($ vs %).
      map.on("click", "tracts-fill", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const id = overlayRef.current;
        const raw = f.properties?.value;
        const value = raw == null ? null : Number(raw);
        const geoid = f.properties?.geoid;
        new maplibregl.Popup({ closeButton: true })
          .setLngLat(e.lngLat)
          .setHTML(`
            <div class="text-xs">
              <div class="opacity-60 uppercase tracking-wider text-[10px]">${escapeHtml(overlayMeta(id).label)} · tract ${String(geoid).slice(-6)}</div>
              <div class="text-sm font-medium mt-1">${formatMetric(id, value)}</div>
            </div>
          `).addTo(map);
      });

      // Demolition popup: address + date.
      map.on("click", "demolitions-circles", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
        new maplibregl.Popup({ closeButton: true, offset: 8 })
          .setLngLat(coords)
          .setHTML(`<div class="text-xs"><div class="uppercase tracking-wider opacity-60 text-[10px]">Demolition permit</div><div class="mt-1">${formatYMD(f.properties?.event_date) || ""}</div></div>`)
          .addTo(map);
      });

      ["clusters", "unclustered", "tracts-fill", "demolitions-circles"].forEach((id) => {
        map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
      });
    });

    mapRef.current = map;
    return () => {
      window.removeEventListener("resize", forceResize);
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Push points whenever they change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = () => {
      const src = map.getSource("projects") as GeoJSONSource | undefined;
      if (!src) return;
      src.setData({
        type: "FeatureCollection",
        features: points.map((p) => ({
          type: "Feature",
          properties: { id: p.id, name: p.name, project_type: p.project_type, status: p.status },
          geometry: { type: "Point", coordinates: [p.lng, p.lat] },
        })),
      });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [points]);

  // Choropleth: fetch + apply on overlay change.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const apply = async () => {
      const src = map.getSource("tracts") as GeoJSONSource | undefined;
      if (!src) return;
      if (overlay === "none") {
        src.setData({ type: "FeatureCollection", features: [] });
        setRamp(null);
        return;
      }
      const resp = await fetch(`/api/overlays/tracts?metric=${overlay}`);
      if (!resp.ok) return;
      const data = await resp.json();
      // Coerce values to numbers defensively. NUMERIC columns sometimes
      // come back as strings even though we cast in SQL.
      for (const f of data.features) {
        const raw = f.properties?.value;
        f.properties.value = raw == null ? null : Number(raw);
      }
      const values: number[] = data.features
        .map((f: { properties: { value: number | null } }) => f.properties.value)
        .filter((v: number | null): v is number => v != null && Number.isFinite(v));
      if (values.length === 0) return;
      const sorted = [...values].sort((a, b) => a - b);
      const lo = Number(sorted[Math.floor(sorted.length * 0.05)]);
      const hi = Number(sorted[Math.floor(sorted.length * 0.95)]);
      src.setData(data);
      map.setPaintProperty("tracts-fill", "fill-color", [
        "interpolate", ["linear"], ["to-number", ["coalesce", ["get", "value"], lo]],
        lo, CHORO.lo, (lo + hi) / 2, CHORO.mid, hi, CHORO.hi,
      ]);
      setRamp({ lo, hi });
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [overlay]);

  // Demolitions layer toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = async () => {
      map.setLayoutProperty("demolitions-circles", "visibility", showDemolitions ? "visible" : "none");
      if (showDemolitions) {
        const src = map.getSource("demolitions") as GeoJSONSource | undefined;
        if (!src) return;
        const resp = await fetch("/api/overlays/demolitions");
        if (!resp.ok) return;
        src.setData(await resp.json());
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [showDemolitions]);

  // Violations layer toggle.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const apply = async () => {
      map.setLayoutProperty("violations-circles", "visibility", showViolations ? "visible" : "none");
      if (showViolations) {
        const src = map.getSource("violations") as GeoJSONSource | undefined;
        if (!src) return;
        const resp = await fetch("/api/overlays/violations");
        if (!resp.ok) return;
        src.setData(await resp.json());
      }
    };
    if (map.isStyleLoaded()) apply();
    else map.once("load", apply);
  }, [showViolations]);

  // If we have a `near` filter, fly there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !filters.near) return;
    map.flyTo({ center: [filters.near.lng, filters.near.lat], zoom: 14 });
  }, [filters.near?.lat, filters.near?.lng]);

  return (
    <>
      <div ref={containerRef} className="w-full h-full" />
      {error && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-[var(--panel)] border border-red-500/50 rounded-lg px-4 py-3 text-sm text-red-300 w-[calc(100vw-2rem)] max-w-md break-words shadow-lg z-10">
          {error}
        </div>
      )}
      <Overlays
        overlay={overlay} setOverlay={setOverlay}
        showDemolitions={showDemolitions} setShowDemolitions={setShowDemolitions}
        showViolations={showViolations} setShowViolations={setShowViolations}
      />
      <Legend overlay={overlay} ramp={ramp} showDemolitions={showDemolitions} showViolations={showViolations} />
    </>
  );
}

function Overlays({
  overlay, setOverlay,
  showDemolitions, setShowDemolitions,
  showViolations, setShowViolations,
}: {
  overlay: OverlayId;
  setOverlay: (v: OverlayId) => void;
  showDemolitions: boolean;
  setShowDemolitions: (v: boolean) => void;
  showViolations: boolean;
  setShowViolations: (v: boolean) => void;
}) {
  return (
    <div className="absolute top-4 left-4 bg-[var(--panel)]/95 backdrop-blur border border-[var(--line)] rounded-lg px-3 py-2.5 text-xs shadow-lg space-y-2 min-w-[230px]">
      <div className="text-[10px] uppercase tracking-wider text-[var(--ink-dim)]">Equity overlay</div>
      <select
        value={overlay}
        onChange={(e) => setOverlay(e.target.value as OverlayId)}
        className="w-full bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs"
      >
        {OVERLAY_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
      <label className="flex items-center gap-2 text-xs pt-1">
        <input type="checkbox" checked={showDemolitions} onChange={(e) => setShowDemolitions(e.target.checked)} />
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "var(--down)" }} />Demolition permits (3y)</span>
      </label>
      <label className="flex items-center gap-2 text-xs">
        <input type="checkbox" checked={showViolations} onChange={(e) => setShowViolations(e.target.checked)} />
        <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: "var(--warn)" }} />Housing-code violations (1y)</span>
      </label>
    </div>
  );
}

function Legend({
  overlay, ramp, showDemolitions, showViolations,
}: {
  overlay: OverlayId;
  ramp: { lo: number; hi: number } | null;
  showDemolitions: boolean;
  showViolations: boolean;
}) {
  const entries: ProjectType[] = ["housing", "transit", "zoning", "infrastructure"];
  const meta = overlayMeta(overlay);
  const showChoro = overlay !== "none" && ramp;
  return (
    <div className="absolute bottom-4 right-4 bg-[var(--panel)]/95 backdrop-blur border border-[var(--line)] rounded-lg px-3 py-2.5 text-xs space-y-2 shadow-lg max-w-[220px]">
      {showChoro && (
        <div className="space-y-1 pb-2 border-b border-[var(--line)]">
          <div className="t-eyebrow">{meta.label}</div>
          <div
            className="h-2 w-full rounded"
            style={{ background: `linear-gradient(90deg, ${CHORO.lo}, ${CHORO.mid}, ${CHORO.hi})` }}
          />
          <div className="flex justify-between t-meta">
            <span>{formatMetric(overlay, ramp!.lo)}</span>
            <span>{formatMetric(overlay, ramp!.hi)}</span>
          </div>
        </div>
      )}
      <div className="space-y-1.5">
        {entries.map((t) => (
          <div key={t} className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
            <span>{TYPE_LABELS[t]}</span>
          </div>
        ))}
        {showDemolitions && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--down)" }} />
            <span>Demolition permit</span>
          </div>
        )}
        {showViolations && (
          <div className="flex items-center gap-2">
            <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: "var(--warn)" }} />
            <span>Code violation</span>
          </div>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
