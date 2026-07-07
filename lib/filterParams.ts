import type { ProjectFilters, ProjectStatus, ProjectType } from "./types";
import { PROJECT_STATUSES, PROJECT_TYPES } from "./types";

function intersect<T extends string>(values: string[] | undefined, allowed: readonly T[]): T[] | undefined {
  if (!values?.length) return undefined;
  const out = values.filter((v): v is T => (allowed as readonly string[]).includes(v));
  return out.length ? out : undefined;
}

export function parseFiltersFromSearchParams(sp: URLSearchParams): ProjectFilters {
  const types = intersect<ProjectType>(sp.getAll("type"), PROJECT_TYPES);
  const statuses = intersect<ProjectStatus>(sp.getAll("status"), PROJECT_STATUSES);
  const neighborhood = sp.get("neighborhood") || undefined;
  const fundingSource = sp.get("funding") || undefined;
  const districtId = sp.get("district") ? Number(sp.get("district")) : undefined;
  const developer = sp.get("developer") || undefined;
  const q = sp.get("q") || undefined;

  // A year that isn't a plausible 4-digit integer would produce a bogus
  // `${year}-01-01` date string downstream (a 500 from Postgres). Clamp instead.
  const year = (key: string): number | undefined => {
    const raw = sp.get(key);
    if (!raw) return undefined;
    const n = parseInt(raw, 10);
    return Number.isInteger(n) && n >= 1900 && n <= 2100 ? n : undefined;
  };

  // radius/lat/lng flow into ST_DWithin. Number("Infinity") is a valid number
  // but NOT finite, so an Infinity radius would sweep the whole table. Require
  // finite values and sane geographic bounds; clamp the radius to <= 50km.
  const lat = sp.get("lat") ? Number(sp.get("lat")) : undefined;
  const lng = sp.get("lng") ? Number(sp.get("lng")) : undefined;
  const radiusRaw = sp.get("radius") ? Number(sp.get("radius")) : undefined;
  const near =
    lat != null && lng != null && radiusRaw != null &&
    Number.isFinite(lat) && Number.isFinite(lng) && Number.isFinite(radiusRaw) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && radiusRaw > 0
      ? { lat, lng, radiusMeters: Math.min(radiusRaw, 50000) }
      : undefined;

  return {
    types, statuses, neighborhood, fundingSource, developer, q,
    districtId: Number.isFinite(districtId) ? districtId : undefined,
    startYear: year("startYear"),
    endYear: year("endYear"),
    near,
  };
}
