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
  const startYear = sp.get("startYear") ? Number(sp.get("startYear")) : undefined;
  const endYear = sp.get("endYear") ? Number(sp.get("endYear")) : undefined;
  const lat = sp.get("lat") ? Number(sp.get("lat")) : undefined;
  const lng = sp.get("lng") ? Number(sp.get("lng")) : undefined;
  const radius = sp.get("radius") ? Number(sp.get("radius")) : undefined;
  const near = (lat != null && lng != null && radius != null && !Number.isNaN(lat) && !Number.isNaN(lng) && !Number.isNaN(radius))
    ? { lat, lng, radiusMeters: radius }
    : undefined;

  return {
    types, statuses, neighborhood, fundingSource, developer, q,
    districtId: Number.isFinite(districtId) ? districtId : undefined,
    startYear: Number.isFinite(startYear) ? startYear : undefined,
    endYear: Number.isFinite(endYear) ? endYear : undefined,
    near,
  };
}
