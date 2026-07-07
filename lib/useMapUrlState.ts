"use client";

import { useEffect, useRef } from "react";
import { mergeViewParams, parseViewParams, VIEW_KEYS, type ViewState } from "./mapViewParams";

// Write view-state into the URL WITHOUT a server round-trip. app/page.tsx is
// force-dynamic and reads searchParams, so any router.push/replace re-runs all
// its DB queries. Native history.replaceState is the only shallow update in Next
// that skips the server — and we pass the EXISTING history.state so Next's
// router tree (stored there) survives Back/Forward.
export function writeViewNow(patch: Partial<ViewState>): void {
  if (typeof window === "undefined") return;
  const sp = mergeViewParams(new URLSearchParams(window.location.search), patch);
  const qs = sp.toString();
  const url = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
  window.history.replaceState(window.history.state, "", url);
}

// A debounced writer for continuous events (camera moveend). Discrete toggles
// should call writeViewNow directly so the URL updates immediately.
export function useViewWriter() {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (patch: Partial<ViewState>, delay = 300) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => writeViewNow(patch), delay);
  };
}

// Copy the current view keys out of the live URL into a target params object —
// used by the sidebar so a filter navigation (which rebuilds the query from
// filters alone) doesn't wipe the camera/overlay/layers/selection.
export function copyViewKeysInto(target: URLSearchParams): URLSearchParams {
  if (typeof window === "undefined") return target;
  const cur = new URLSearchParams(window.location.search);
  for (const k of VIEW_KEYS) {
    const v = cur.get(k);
    if (v != null) target.set(k, v);
  }
  return target;
}

// Re-parse the URL on Back/Forward so the map (which seeds view-state once) can
// reconcile when navigation lands on a history entry with different view keys.
export function usePopstateView(onChange: (v: ViewState) => void): void {
  const cb = useRef(onChange);
  cb.current = onChange;
  useEffect(() => {
    const handler = () => cb.current(parseViewParams(new URLSearchParams(window.location.search)));
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);
}
