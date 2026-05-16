"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MapLibreMap, type GeoJSONSource } from "maplibre-gl";
import type { MapProject } from "@/lib/projects";
import type { ProjectFilters, ProjectType } from "@/lib/types";
import { TYPE_COLORS, TYPE_LABELS, STATUS_LABELS } from "@/lib/types";

interface Props {
  points: MapProject[];
  filters: ProjectFilters;
}

const PHL_CENTER: [number, number] = [-75.1652, 39.9526];
const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

export default function MapView({ points, filters }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  // Initialize the map once.
  useEffect(() => {
    if (mapRef.current || !containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: STYLE_URL,
      center: PHL_CENTER,
      zoom: 11.5,
      attributionControl: { compact: true },
    });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch: false }), "top-right");
    map.addControl(new maplibregl.ScaleControl({ unit: "imperial" }), "bottom-left");

    map.on("load", () => {
      map.addSource("projects", {
        type: "geojson",
        data: { type: "FeatureCollection", features: [] },
        cluster: true,
        clusterMaxZoom: 13,
        clusterRadius: 50,
      });

      map.addLayer({
        id: "clusters",
        type: "circle",
        source: "projects",
        filter: ["has", "point_count"],
        paint: {
          "circle-color": ["step", ["get", "point_count"], "#4b5563", 10, "#6b7280", 50, "#9ca3af"],
          "circle-radius": ["step", ["get", "point_count"], 16, 10, 22, 50, 28],
          "circle-stroke-width": 2,
          "circle-stroke-color": "#e7ebef",
        },
      });
      map.addLayer({
        id: "cluster-count",
        type: "symbol",
        source: "projects",
        filter: ["has", "point_count"],
        layout: {
          "text-field": "{point_count_abbreviated}",
          "text-size": 12,
          "text-font": ["Noto Sans Bold", "Open Sans Bold", "Arial Unicode MS Bold"],
        },
        paint: { "text-color": "#0b0c0e" },
      });
      map.addLayer({
        id: "unclustered",
        type: "circle",
        source: "projects",
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
        // geometry is a Point on the cluster feature itself.
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
          .setLngLat(coords)
          .setHTML(html)
          .addTo(map);
      });

      ["clusters", "unclustered"].forEach((id) => {
        map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
        map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
      });
    });

    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, []);

  // Push new points whenever the props change.
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

  // If we have a `near` filter, fly there.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !filters.near) return;
    map.flyTo({ center: [filters.near.lng, filters.near.lat], zoom: 14 });
  }, [filters.near?.lat, filters.near?.lng]);

  return (
    <>
      <div ref={containerRef} className="absolute inset-0" />
      <Legend />
    </>
  );
}

function Legend() {
  const entries: ProjectType[] = ["housing", "transit", "zoning", "infrastructure"];
  return (
    <div className="absolute bottom-4 right-4 bg-[var(--panel)]/95 backdrop-blur border border-[var(--line)] rounded-lg px-3 py-2.5 text-xs space-y-1.5 shadow-lg">
      {entries.map((t) => (
        <div key={t} className="flex items-center gap-2">
          <span className="inline-block w-2.5 h-2.5 rounded-full" style={{ backgroundColor: TYPE_COLORS[t] }} />
          <span>{TYPE_LABELS[t]}</span>
        </div>
      ))}
    </div>
  );
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!
  ));
}
