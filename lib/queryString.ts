import type { ProjectFilters } from "./types";

// Serialize ProjectFilters to a query string. Extracted verbatim from Sidebar so
// the /api/ask route and the sidebar share ONE implementation. Preserves the
// contract: returns a "?"-prefixed string, or "" when there are no filters (the
// CSV-export href and the router.push path both depend on that).
export function buildQuery(filters: ProjectFilters): string {
  const sp = new URLSearchParams();
  filters.types?.forEach((t) => sp.append("type", t));
  filters.statuses?.forEach((s) => sp.append("status", s));
  if (filters.neighborhood) sp.set("neighborhood", filters.neighborhood);
  if (filters.fundingSource) sp.set("funding", filters.fundingSource);
  if (filters.districtId) sp.set("district", String(filters.districtId));
  if (filters.developer) sp.set("developer", filters.developer);
  if (filters.q) sp.set("q", filters.q);
  if (filters.startYear) sp.set("startYear", String(filters.startYear));
  if (filters.endYear) sp.set("endYear", String(filters.endYear));
  if (filters.near) {
    sp.set("lat", String(filters.near.lat));
    sp.set("lng", String(filters.near.lng));
    sp.set("radius", String(filters.near.radiusMeters));
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}
