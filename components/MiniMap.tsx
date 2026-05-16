"use client";

import { useEffect, useRef } from "react";
import maplibregl, { type Map as MapLibreMap } from "maplibre-gl";

interface Props { lat: number; lng: number; color: string; }

const STYLE_URL = process.env.NEXT_PUBLIC_MAP_STYLE_URL || "https://tiles.openfreemap.org/styles/positron";

export default function MiniMap({ lat, lng, color }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!ref.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: ref.current,
      style: STYLE_URL,
      center: [lng, lat],
      zoom: 14,
      attributionControl: { compact: true },
      interactive: true,
    });
    const el = document.createElement("div");
    el.style.cssText = `
      width:18px;height:18px;border-radius:999px;
      background:${color};border:2px solid #0b0c0e;
      box-shadow:0 0 0 3px ${color}40;
    `;
    new maplibregl.Marker({ element: el }).setLngLat([lng, lat]).addTo(map);
    mapRef.current = map;
    return () => { map.remove(); mapRef.current = null; };
  }, [lat, lng, color]);

  return <div ref={ref} className="w-full h-full" />;
}
