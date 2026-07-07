"use client";

import { useEffect, useRef, useState } from "react";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import type { MapProject } from "@/lib/projects";
import type { ProjectFilters, ProjectType } from "@/lib/types";
import { TYPE_COLORS, TYPE_LABELS, STATUS_LABELS } from "@/lib/types";
import { formatYMD } from "@/lib/dates";
import { OVERLAY_OPTIONS, overlayMeta, DEFAULT_VIEW, type OverlayId, type ViewState } from "@/lib/mapViewParams";
import { writeViewNow, useViewWriter, usePopstateView } from "@/lib/useMapUrlState";
import { useSelectedId, setSelected, setHovered, getSelected, getHovered, subscribe as subscribeSelection } from "@/lib/mapSelection";

interface Props {
  points: MapProject[];
  filters: ProjectFilters;
  initialView?: ViewState;
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

// Show the highlight ring only for unclustered points whose id is in `ids`.
const HIGHLIGHT_FILTER = (ids: number[]): maplibregl.FilterSpecification =>
  ["all", ["!", ["has", "point_count"]], ["in", ["get", "id"], ["literal", ids]]];

function formatMetric(id: OverlayId, v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return "—";
  const scale = (overlayMeta(id) as { scale?: string }).scale;
  if (scale === "income") return `$${Math.round(v).toLocaleString()}`;
  if (scale === "pct") return `${Math.round(v)}%`;
  return String(v);
}

export default function MapView({ points, filters, initialView = DEFAULT_VIEW }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Seed every view slice from the server-parsed URL so the controls/legend
  // render correct on first paint (no flash, no hydration mismatch).
  const [overlay, setOverlay] = useState<OverlayId>(initialView.overlay);
  const [ramp, setRamp] = useState<{ lo: number; hi: number } | null>(null);
  const [showDemolitions, setShowDemolitions] = useState(initialView.showDemolitions);
  const [showViolations, setShowViolations] = useState(initialView.showViolations);
  // Selection lives in the shared store (so the sidebar list stays in sync);
  // read it as React state here for the URL-sync effect. Seed the store once
  // from the shared `sel=` link (in an effect so we never notify during render).
  const selectedId = useSelectedId();
  useEffect(() => { setSelected(initialView.selected); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Mirror latest state into refs so the once-bound map handlers read current
  // values, and so the debounced moveend writer never uses stale slices.
  const overlayRef = useRef<OverlayId>(initialView.overlay);
  overlayRef.current = overlay;
  // An explicit shared camera (`c` in the URL) must win over the Near-Me flyTo
  // on first load; consumed once.
  const hadInitialCamera = useRef<boolean>(!!initialView.center);
  // Suppress the camera writer while we programmatically move the map (initial
  // selection easeTo, popstate reconcile) so it doesn't echo back into the URL.
  const suppressWrite = useRef(false);
  const writeCamera = useViewWriter();

  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    let map: MapLibreMap;
    try {
      map = new maplibregl.Map({
        container: containerRef.current,
        style: STYLE_URL,
        // Construct AT the shared camera — no post-init flyTo, so no synthetic
        // moveend to echo back into the URL.
        center: initialView.center ?? PHL_CENTER,
        zoom: initialView.zoom ?? 11.5,
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

    // Persist the camera into the URL when it settles (debounced, replaceState),
    // so panning/zooming makes the view shareable without a server round-trip or
    // a Back-button entry per frame. Skipped while we move the map ourselves.
    map.on("moveend", () => {
      if (suppressWrite.current) return;
      writeCamera({ center: map.getCenter().toArray() as [number, number], zoom: map.getZoom() });
    });

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
      // Highlight ring for the hovered/selected project — an accent stroke on a
      // transparent fill drawn over the dot. The filter is driven imperatively
      // from the shared store (see the subscription effect) so hovering the
      // list or the map never re-renders React.
      map.addLayer({
        id: "project-highlight", type: "circle", source: "projects",
        filter: HIGHLIGHT_FILTER([]),
        paint: {
          "circle-radius": 12,
          "circle-color": "rgba(0,0,0,0)",
          "circle-stroke-width": 3,
          "circle-stroke-color": "#ffd166",
        },
      });
      // Reflect any already-set selection (a shared `sel=` link) now that the
      // layer exists; ongoing changes are handled by the subscription effect.
      map.setFilter("project-highlight",
        HIGHLIGHT_FILTER([getHovered(), getSelected()].filter((v): v is number => v != null)));

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

      // Shared opener so a click and a shared `sel=` link render the same popup
      // and keep `selectedId` (hence the URL) in sync.
      const openProjectPopup = (
        coords: [number, number],
        props: { id: number; name: string; project_type: ProjectType; status: string },
      ) => {
        const label = TYPE_LABELS[props.project_type] || "Project";
        const status = STATUS_LABELS[props.status as keyof typeof STATUS_LABELS] || props.status;
        const html = `
          <div class="text-sm leading-snug">
            <div class="text-[10px] uppercase tracking-wider opacity-60">${label} · ${status}</div>
            <div class="font-medium mt-1 mb-2">${escapeHtml(props.name)}</div>
            <a href="/projects/${props.id}" class="text-xs underline underline-offset-2 hover:opacity-80">Open details &rarr;</a>
          </div>`;
        const popup = new maplibregl.Popup({ closeButton: true, offset: 14 })
          .setLngLat(coords).setHTML(html).addTo(map);
        setSelected(props.id);
        popup.on("close", () => {
          // Only clear if this popup is still the selected one (a new click
          // already updated the selection before this close fires).
          if (getSelected() === props.id) setSelected(null);
        });
      };

      map.on("click", "unclustered", (e) => {
        const f = e.features?.[0];
        if (!f) return;
        const props = f.properties as { id: number; name: string; project_type: ProjectType; status: string };
        const coords = (f.geometry as unknown as { coordinates: [number, number] }).coordinates;
        openProjectPopup(coords, props);
      });

      // Hover a pin -> highlight the matching sidebar row (and vice-versa, wired
      // from the list). Uses the shared store; the highlight ring updates
      // imperatively below without re-rendering the map.
      map.on("mousemove", "unclustered", (e) => {
        const id = e.features?.[0]?.properties?.id;
        if (typeof id === "number") setHovered(id);
      });
      map.on("mouseleave", "unclustered", () => setHovered(null));

      // A shared `sel=` link: open the same popup for that project once points
      // are present, and ease to it only if the URL didn't also pin a camera.
      if (initialView.selected != null) {
        const hit = points.find((p) => p.id === initialView.selected);
        if (hit) {
          openProjectPopup([hit.lng, hit.lat], {
            id: hit.id, name: hit.name, project_type: hit.project_type, status: hit.status,
          });
          if (!initialView.center) {
            suppressWrite.current = true;
            map.easeTo({ center: [hit.lng, hit.lat], zoom: Math.max(map.getZoom(), 15) });
            map.once("moveend", () => { suppressWrite.current = false; });
          }
        }
      }

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

  // If we have a `near` filter, fly there — but let an explicit shared camera
  // (`c` in the URL) win on the very first load.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !filters.near) return;
    if (hadInitialCamera.current) { hadInitialCamera.current = false; return; }
    map.flyTo({ center: [filters.near.lng, filters.near.lat], zoom: 14 });
  }, [filters.near?.lat, filters.near?.lng]);

  // Mirror discrete view slices into the URL. Skip the first run of each so we
  // don't rewrite the URL with the values we just seeded from it.
  const seededOverlay = useRef(false);
  useEffect(() => {
    if (!seededOverlay.current) { seededOverlay.current = true; return; }
    writeViewNow({ overlay });
  }, [overlay]);
  const seededDemo = useRef(false);
  useEffect(() => {
    if (!seededDemo.current) { seededDemo.current = true; return; }
    writeViewNow({ showDemolitions });
  }, [showDemolitions]);
  const seededViol = useRef(false);
  useEffect(() => {
    if (!seededViol.current) { seededViol.current = true; return; }
    writeViewNow({ showViolations });
  }, [showViolations]);
  const seededSel = useRef(false);
  useEffect(() => {
    if (!seededSel.current) { seededSel.current = true; return; }
    writeViewNow({ selected: selectedId });
  }, [selectedId]);

  // Keep the map's highlight ring in sync with the shared store (hover/select)
  // imperatively, so hovering the list or the map never re-renders the map.
  useEffect(() => {
    const applyHighlight = () => {
      const map = mapRef.current;
      if (!map || !map.getLayer("project-highlight")) return;
      const ids = [getHovered(), getSelected()].filter((v): v is number => v != null);
      map.setFilter("project-highlight", HIGHLIGHT_FILTER(ids));
    };
    applyHighlight();
    return subscribeSelection(applyHighlight);
  }, []);

  // Back/Forward reconcile: MapView seeds view-state once, so a history entry
  // with different view keys would desync the map from the URL. Re-parse on
  // popstate and jump the map/controls to match, suppressing the echo write.
  usePopstateView((v) => {
    const map = mapRef.current;
    setOverlay(v.overlay);
    setShowDemolitions(v.showDemolitions);
    setShowViolations(v.showViolations);
    setSelected(v.selected);
    if (map && v.center && v.zoom != null) {
      suppressWrite.current = true;
      map.jumpTo({ center: v.center, zoom: v.zoom });
      // jumpTo fires moveend synchronously-ish; clear on the next tick.
      map.once("moveend", () => { suppressWrite.current = false; });
      setTimeout(() => { suppressWrite.current = false; }, 350);
    }
  });

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
      <ShareButton />
    </div>
  );
}

function ShareButton() {
  const [copied, setCopied] = useState(false);
  const share = async () => {
    // The URL is already complete: filters live in location.search (router) and
    // view-state is continuously synced there via replaceState.
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Insecure-context fallback.
      const ta = document.createElement("textarea");
      ta.value = url; ta.style.position = "fixed"; ta.style.opacity = "0";
      document.body.appendChild(ta); ta.select();
      try { document.execCommand("copy"); } catch { /* give up quietly */ }
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      type="button"
      onClick={share}
      className="w-full mt-1 rounded border border-[var(--line)] px-2 py-1.5 text-xs hover:border-[var(--accent)] hover:text-[var(--ink)] transition-colors"
    >
      {copied ? "Copied link ✓" : "Share this view"}
    </button>
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
