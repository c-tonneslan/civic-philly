import { query } from "./db";

export interface Transfer {
  id: number;
  document_type: string;
  transfer_date: string;
  address: string | null;
  zip: string | null;
  grantor: string | null;
  grantee: string | null;
  consideration: number | null;
  fair_market_value: number | null;
  lat: number;
  lng: number;
}

// All transfers within `meters` of (lat,lng). Useful for the "this
// neighborhood is being bought up" panel on project detail.
export async function getTransfersWithin(
  lat: number, lng: number, meters = 400, limit = 20,
): Promise<Transfer[]> {
  const r = await query<Transfer>(
    `SELECT id, document_type, transfer_date, address, zip,
            grantor, grantee, consideration::float8 AS consideration,
            fair_market_value::float8 AS fair_market_value,
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM civic.transfers
      WHERE ST_DWithin(geom, ST_SetSRID(ST_MakePoint($1,$2),4326)::geography, $3)
      ORDER BY transfer_date DESC
      LIMIT $4`,
    [lng, lat, meters, limit],
  );
  return r.rows;
}

// Transfers exactly at this address (case-insensitive). Powers the
// "ownership history at this address" panel.
export async function getTransfersAtAddress(
  address: string, limit = 20,
): Promise<Transfer[]> {
  const r = await query<Transfer>(
    `SELECT id, document_type, transfer_date, address, zip,
            grantor, grantee, consideration::float8 AS consideration,
            fair_market_value::float8 AS fair_market_value,
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng
       FROM civic.transfers
      WHERE UPPER(address) = UPPER($1)
      ORDER BY transfer_date DESC
      LIMIT $2`,
    [address, limit],
  );
  return r.rows;
}

export interface BuyerSummary {
  grantee: string;
  n_purchases: number;
  total_consideration: number;
  districts: number[];
}

// Top buyers in the last N months. Filters out the obvious bulk
// recipients (mortgage trustees, common deeds-of-trust patterns) by
// requiring 2+ purchases.
export async function getTopBuyers(months = 12, limit = 50): Promise<BuyerSummary[]> {
  const r = await query<{
    grantee: string;
    n_purchases: string;
    total_consideration: string;
    districts: number[];
  }>(`
    WITH recent AS (
      SELECT t.grantee, t.consideration, t.geom
        FROM civic.transfers t
       WHERE t.grantee IS NOT NULL
         AND t.transfer_date >= NOW() - ($1 || ' months')::interval
    ),
    -- Count purchases before touching the district join. A transfer whose point
    -- intersects two districts would otherwise be double-counted by the fan-out.
    buyers AS (
      SELECT grantee,
             COUNT(*) AS n_purchases,
             SUM(consideration) AS total_consideration
        FROM recent
       GROUP BY grantee
      HAVING COUNT(*) >= 2
    ),
    buyer_districts AS (
      SELECT r.grantee,
             COALESCE(
               ARRAY_AGG(DISTINCT d.id ORDER BY d.id)
                 FILTER (WHERE d.id IS NOT NULL),
               '{}'
             ) AS districts
        FROM recent r
        LEFT JOIN civic.council_districts d ON ST_Intersects(r.geom, d.geom)
       GROUP BY r.grantee
    )
    SELECT b.grantee,
           b.n_purchases::text AS n_purchases,
           b.total_consideration::text AS total_consideration,
           bd.districts
      FROM buyers b
      JOIN buyer_districts bd ON bd.grantee = b.grantee
     ORDER BY b.n_purchases DESC, b.total_consideration DESC
     LIMIT $2
  `, [String(months), limit]);

  return r.rows.map((row) => ({
    grantee: row.grantee,
    n_purchases: Number(row.n_purchases),
    total_consideration: Number(row.total_consideration),
    districts: row.districts ?? [],
  }));
}

// Owner network: group property_owners by mailing_address. When 8 LLCs
// all use the same mailing address, that's the same beneficial owner.
export interface NetworkRow {
  mailing_address: string;
  mailing_city_state: string | null;
  owners: string[];
  parcel_count: number;
  total_market_value: number | null;
}

export async function getOwnerNetworks(limit = 50): Promise<NetworkRow[]> {
  const r = await query<{
    mailing_address: string;
    mailing_city_state: string | null;
    owners: string[];
    parcel_count: string;
    total_market_value: string | null;
  }>(`
    SELECT mailing_address,
           MAX(mailing_city_state) AS mailing_city_state,
           ARRAY_AGG(DISTINCT owner_1 ORDER BY owner_1) AS owners,
           COUNT(*)::text AS parcel_count,
           SUM(market_value)::text AS total_market_value
      FROM civic.property_owners
     WHERE mailing_address IS NOT NULL
     GROUP BY mailing_address
     HAVING COUNT(DISTINCT owner_1) >= 2
     ORDER BY COUNT(DISTINCT owner_1) DESC, COUNT(*) DESC
     LIMIT $1
  `, [limit]);

  return r.rows.map((row) => ({
    mailing_address: row.mailing_address,
    mailing_city_state: row.mailing_city_state,
    owners: row.owners ?? [],
    parcel_count: Number(row.parcel_count),
    total_market_value: row.total_market_value != null ? Number(row.total_market_value) : null,
  }));
}
