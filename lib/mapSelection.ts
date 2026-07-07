"use client";

import { useSyncExternalStore } from "react";

// Tiny client-only store shared between the sidebar list and the map so the two
// panes behave like one object (Zillow/Redfin split view): hovering a list row
// highlights its map pin and vice-versa; clicking a pin selects it and scrolls
// the matching row into view. It's a module singleton — both components import
// the same instance even though they live in separate subtrees under MobileShell.
//
// Deliberately NOT React state at the top level: hover changes fire constantly,
// so the map reads this imperatively (setFilter, no re-render) and each list row
// subscribes with a selector that only flips when ITS own state changes.

type Listener = () => void;

let hoveredId: number | null = null;
let selectedId: number | null = null;
const listeners = new Set<Listener>();

function emit() { for (const l of listeners) l(); }
export function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

export function getHovered(): number | null { return hoveredId; }
export function getSelected(): number | null { return selectedId; }

export function setHovered(id: number | null): void {
  if (hoveredId === id) return;
  hoveredId = id;
  emit();
}
export function setSelected(id: number | null): void {
  if (selectedId === id) return;
  selectedId = id;
  emit();
}

// Row state code: 0 none, 1 hovered, 2 selected (selected wins). Returning a
// primitive means a row only re-renders when its own code changes, not on every
// hover elsewhere.
export function useRowState(id: number): 0 | 1 | 2 {
  return useSyncExternalStore(
    subscribe,
    () => (selectedId === id ? 2 : hoveredId === id ? 1 : 0),
    () => 0,
  );
}

// Selection as React state, for the pieces that legitimately need to re-render
// on select (URL sync). Hover intentionally has no such hook.
export function useSelectedId(): number | null {
  return useSyncExternalStore(subscribe, () => selectedId, () => null);
}
