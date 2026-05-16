import { query } from "./db";

export interface Owner {
  parcel_number: string;
  owner_1: string | null;
  owner_2: string | null;
  mailing_address: string | null;
  mailing_city_state: string | null;
  mailing_zip: string | null;
  location_address: string | null;
  market_value: number | null;
}

export interface OwnerSummary {
  owner: string;
  total_parcels: number;
  project_count: number;
  total_market_value: number | null;
  districts: number[];
}

// Aggregate parcels by owner_1. Two normalizations: collapse trailing
// whitespace, and treat owner_1 as case-sensitive for now (OPA is
// inconsistent; we don't want to merge "PHA" with "Philadelphia Housing
// Authority" without an explicit rule).
export async function listTopOwners(limit = 50): Promise<OwnerSummary[]> {
  const r = await query<{
    owner: string;
    total_parcels: string;
    project_count: string;
    total_market_value: string | null;
    districts: number[];
  }>(`
    SELECT po.owner_1 AS owner,
           COUNT(DISTINCT po.parcel_number)::text AS total_parcels,
           COUNT(DISTINCT p.id)::text AS project_count,
           SUM(po.market_value)::text AS total_market_value,
           COALESCE(
             ARRAY_AGG(DISTINCT p.council_district_id ORDER BY p.council_district_id)
               FILTER (WHERE p.council_district_id IS NOT NULL),
             '{}'
           ) AS districts
      FROM civic.property_owners po
      JOIN civic.projects p ON p.opa_account = po.parcel_number
     WHERE po.owner_1 IS NOT NULL
     GROUP BY po.owner_1
     ORDER BY total_parcels DESC, project_count DESC
     LIMIT $1
  `, [limit]);
  return r.rows.map((row) => ({
    owner: row.owner,
    total_parcels: Number(row.total_parcels),
    project_count: Number(row.project_count),
    total_market_value: row.total_market_value != null ? Number(row.total_market_value) : null,
    districts: row.districts ?? [],
  }));
}

export async function getOwnerSummary(name: string): Promise<OwnerSummary | null> {
  const r = await query<{
    owner: string; total_parcels: string; project_count: string;
    total_market_value: string | null; districts: number[];
  }>(`
    SELECT po.owner_1 AS owner,
           COUNT(DISTINCT po.parcel_number)::text AS total_parcels,
           COUNT(DISTINCT p.id)::text AS project_count,
           SUM(po.market_value)::text AS total_market_value,
           COALESCE(
             ARRAY_AGG(DISTINCT p.council_district_id ORDER BY p.council_district_id)
               FILTER (WHERE p.council_district_id IS NOT NULL),
             '{}'
           ) AS districts
      FROM civic.property_owners po
      LEFT JOIN civic.projects p ON p.opa_account = po.parcel_number
     WHERE po.owner_1 = $1
     GROUP BY po.owner_1
  `, [name]);
  if (!r.rows[0]) return null;
  const row = r.rows[0];
  return {
    owner: row.owner,
    total_parcels: Number(row.total_parcels),
    project_count: Number(row.project_count),
    total_market_value: row.total_market_value != null ? Number(row.total_market_value) : null,
    districts: row.districts ?? [],
  };
}

export async function getOwnerParcels(name: string, limit = 100): Promise<Owner[]> {
  const r = await query<Owner>(`
    SELECT parcel_number, owner_1, owner_2,
           mailing_address, mailing_city_state, mailing_zip,
           location_address, market_value
      FROM civic.property_owners
     WHERE owner_1 = $1
     ORDER BY market_value DESC NULLS LAST
     LIMIT $2
  `, [name, limit]);
  return r.rows;
}

export async function getOwnerByParcel(parcel: string): Promise<Owner | null> {
  const r = await query<Owner>(`
    SELECT parcel_number, owner_1, owner_2,
           mailing_address, mailing_city_state, mailing_zip,
           location_address, market_value
      FROM civic.property_owners WHERE parcel_number = $1
  `, [parcel]);
  return r.rows[0] ?? null;
}
