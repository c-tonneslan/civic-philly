export type ProjectType = "housing" | "transit" | "zoning" | "infrastructure";
export type ProjectStatus =
  | "proposed"
  | "approved"
  | "under_construction"
  | "completed"
  | "cancelled"
  | "unknown";

export interface Project {
  id: number;
  datasource_id: string;
  external_id: string;
  project_type: ProjectType;
  name: string;
  description: string | null;
  address: string | null;
  neighborhood: string | null;
  council_district: string | null;
  zip_code: string | null;
  status: ProjectStatus;
  funding_source: string | null;
  funding_amount: number | null;
  units_total: number | null;
  units_affordable: number | null;
  start_date: string | null;
  completion_date: string | null;
  approved_date: string | null;
  source_url: string | null;
  council_district_id: number | null;
  census_tract_geoid: string | null;
  lat: number;
  lng: number;
  first_seen_at: string;
}

export interface CensusTract {
  geoid: string;
  name: string | null;
  total_pop: number | null;
  median_hh_income: number | null;
  pct_rent_burdened: number | null;
  pct_renter: number | null;
  pct_white: number | null;
  pct_black: number | null;
  pct_hispanic: number | null;
  pct_asian: number | null;
  acs_year: number | null;
}

export interface DistrictStats {
  district_id: number;
  district_name: string;
  total_projects: number;
  housing_projects: number;
  transit_projects: number;
  zoning_projects: number;
  infrastructure_projects: number;
  active_projects: number;
  pipeline_projects: number;
  completed_projects: number;
  housing_units_total: number | null;
  housing_units_affordable: number | null;
  total_funding_amount: number | null;
}

export interface ElectedOfficial {
  id: number;
  role: "council_district" | "council_at_large" | "mayor";
  district_id: number | null;
  name: string;
  party: string | null;
  email: string | null;
  phone: string | null;
  office_address: string | null;
  website: string | null;
  twitter: string | null;
}

export interface DisplacementSignal {
  id: number;
  source: "demolition_permit";
  event_date: string;
  address: string | null;
  description: string | null;
  lat: number;
  lng: number;
}

export interface Datasource {
  id: string;
  name: string;
  agency: string;
  homepage_url: string | null;
  feed_url: string | null;
  license: string | null;
  description: string | null;
  quality_notes: string | null;
  last_fetched_at: string | null;
  record_count: number;
  status: "ok" | "degraded" | "down";
}

export interface ProjectFilters {
  types?: ProjectType[];
  statuses?: ProjectStatus[];
  neighborhood?: string;
  fundingSource?: string;
  districtId?: number;
  startYear?: number;
  endYear?: number;
  near?: { lat: number; lng: number; radiusMeters: number };
}

export const PROJECT_TYPES: ProjectType[] = ["housing", "transit", "zoning", "infrastructure"];
export const PROJECT_STATUSES: ProjectStatus[] = [
  "proposed", "approved", "under_construction", "completed", "cancelled", "unknown",
];

export const TYPE_COLORS: Record<ProjectType, string> = {
  housing: "#2563eb",
  transit: "#ea580c",
  zoning: "#9333ea",
  infrastructure: "#16a34a",
};

export const TYPE_LABELS: Record<ProjectType, string> = {
  housing: "Housing",
  transit: "Transit",
  zoning: "Zoning",
  infrastructure: "Infrastructure",
};

export const STATUS_LABELS: Record<ProjectStatus, string> = {
  proposed: "Proposed",
  approved: "Approved",
  under_construction: "Under construction",
  completed: "Completed",
  cancelled: "Cancelled / withdrawn",
  unknown: "Status unknown",
};
