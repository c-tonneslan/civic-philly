// Pure, server-importable helpers for the shareable map-view URL. NO window
// access here — app/page.tsx parses the incoming URL on the server so the map
// hydrates at the right camera/overlay without a flash. The writer side lives
// in lib/useMapUrlState.ts ("use client").
//
// View-state lives in its OWN query keys (c, ov, layers, sel) that
// parseFiltersFromSearchParams never reads, so panning/zooming/toggling never
// widens the server's data-dependency set. The camera is packed into a single
// `c=lng,lat,zoom` key on purpose: lat/lng/radius already belong to the `near`
// filter, so reusing them would turn a camera into a spatial query.

export const OVERLAY_OPTIONS = [
  { id: "none",          label: "None" },
  { id: "rent_burdened", label: "Rent burdened", scale: "pct" },
  { id: "renter",        label: "Renter occupied", scale: "pct" },
  { id: "income",        label: "Median income", scale: "income" },
  { id: "black",         label: "Black population", scale: "pct" },
  { id: "white",         label: "White population", scale: "pct" },
  { id: "hispanic",      label: "Hispanic population", scale: "pct" },
] as const;
export type OverlayId = (typeof OVERLAY_OPTIONS)[number]["id"];

export function overlayMeta(id: OverlayId) {
  return OVERLAY_OPTIONS.find((o) => o.id === id) ?? OVERLAY_OPTIONS[0];
}
function isOverlayId(v: string): v is OverlayId {
  return OVERLAY_OPTIONS.some((o) => o.id === v);
}

export interface ViewState {
  center: [number, number] | null;
  zoom: number | null;
  overlay: OverlayId;
  showDemolitions: boolean;
  showViolations: boolean;
  selected: number | null;
}

export const DEFAULT_VIEW: ViewState = {
  center: null,
  zoom: null,
  overlay: "none",
  showDemolitions: false,
  showViolations: false,
  selected: null,
};

function parseLayers(raw: string | null): { demo: boolean; viol: boolean } {
  const set = new Set((raw ?? "").split(",").map((s) => s.trim()).filter(Boolean));
  return { demo: set.has("demo"), viol: set.has("viol") };
}

export function parseViewParams(sp: URLSearchParams): ViewState {
  const v: ViewState = { ...DEFAULT_VIEW };

  const c = sp.get("c");
  if (c) {
    const [lng, lat, zoom] = c.split(",").map(Number);
    // Defensive, mirroring the near-filter guard: a hand-edited URL must not be
    // able to crash the map with NaN/Infinity or out-of-range coordinates.
    if (
      Number.isFinite(lng) && Number.isFinite(lat) && Number.isFinite(zoom) &&
      lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90 && zoom >= 0 && zoom <= 22
    ) {
      v.center = [lng, lat];
      v.zoom = zoom;
    }
  }

  const ov = sp.get("ov");
  if (ov && isOverlayId(ov)) v.overlay = ov;

  const layers = parseLayers(sp.get("layers"));
  v.showDemolitions = layers.demo;
  v.showViolations = layers.viol;

  const sel = sp.get("sel");
  if (sel) {
    const n = parseInt(sel, 10);
    if (Number.isInteger(n) && n > 0) v.selected = n;
  }

  return v;
}

const round = (n: number, dp: number) => {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
};

// Clone `sp` and rewrite ONLY the view keys named in `patch`, leaving every
// filter key untouched. Values at their default are deleted to keep URLs clean.
export function mergeViewParams(sp: URLSearchParams, patch: Partial<ViewState>): URLSearchParams {
  const out = new URLSearchParams(sp);

  if ("center" in patch || "zoom" in patch) {
    const center = patch.center;
    const zoom = patch.zoom;
    if (!center || zoom == null) {
      out.delete("c");
    } else {
      out.set("c", `${round(center[0], 5)},${round(center[1], 5)},${round(zoom, 2)}`);
    }
  }

  if ("overlay" in patch) {
    if (!patch.overlay || patch.overlay === "none") out.delete("ov");
    else out.set("ov", patch.overlay);
  }

  if ("showDemolitions" in patch || "showViolations" in patch) {
    const cur = parseLayers(out.get("layers"));
    const demo = "showDemolitions" in patch ? !!patch.showDemolitions : cur.demo;
    const viol = "showViolations" in patch ? !!patch.showViolations : cur.viol;
    const parts = [demo ? "demo" : null, viol ? "viol" : null].filter(Boolean);
    if (parts.length) out.set("layers", parts.join(","));
    else out.delete("layers");
  }

  if ("selected" in patch) {
    if (patch.selected == null) out.delete("sel");
    else out.set("sel", String(patch.selected));
  }

  return out;
}

// The view keys, for callers that need to copy them across a filter navigation.
export const VIEW_KEYS = ["c", "ov", "layers", "sel"] as const;
