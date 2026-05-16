import crypto from "node:crypto";
import { query } from "./db";
import type { ProjectType } from "./types";

export interface AlertSubscription {
  id: number;
  email: string;
  address_label: string;
  radius_meters: number;
  project_types: ProjectType[];
  verified: boolean;
  verify_token: string;
  unsubscribe_token: string;
  lat: number;
  lng: number;
  last_notified_at: string | null;
}

export function token(): string {
  return crypto.randomBytes(24).toString("base64url");
}

export async function createSubscription(input: {
  email: string;
  addressLabel: string;
  lat: number;
  lng: number;
  radiusMeters: number;
  projectTypes: ProjectType[];
}): Promise<AlertSubscription> {
  const verify = token();
  const unsub = token();
  const r = await query<AlertSubscription>(
    `INSERT INTO civic.alert_subscriptions
      (email, address_label, radius_meters, project_types,
       verified, verify_token, unsubscribe_token, geom)
     VALUES ($1, $2, $3, $4, FALSE, $5, $6,
             ST_SetSRID(ST_MakePoint($7, $8), 4326)::geography)
     ON CONFLICT (email, address_label) DO UPDATE
       SET radius_meters = EXCLUDED.radius_meters,
           project_types = EXCLUDED.project_types,
           geom = EXCLUDED.geom,
           verify_token = EXCLUDED.verify_token
     RETURNING id, email, address_label, radius_meters, project_types,
               verified, verify_token, unsubscribe_token,
               ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
               last_notified_at`,
    [input.email, input.addressLabel, input.radiusMeters, input.projectTypes,
     verify, unsub, input.lng, input.lat],
  );
  return r.rows[0];
}

export async function verifySubscription(verifyToken: string): Promise<AlertSubscription | null> {
  const r = await query<AlertSubscription>(
    `UPDATE civic.alert_subscriptions
       SET verified = TRUE
     WHERE verify_token = $1
     RETURNING id, email, address_label, radius_meters, project_types,
               verified, verify_token, unsubscribe_token,
               ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
               last_notified_at`,
    [verifyToken],
  );
  return r.rows[0] ?? null;
}

export async function unsubscribe(unsubToken: string): Promise<boolean> {
  const r = await query(
    "DELETE FROM civic.alert_subscriptions WHERE unsubscribe_token = $1",
    [unsubToken],
  );
  return (r.rowCount ?? 0) > 0;
}

export async function listVerifiedSubscriptions(): Promise<AlertSubscription[]> {
  const r = await query<AlertSubscription>(
    `SELECT id, email, address_label, radius_meters, project_types,
            verified, verify_token, unsubscribe_token,
            ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
            last_notified_at
       FROM civic.alert_subscriptions
       WHERE verified = TRUE`,
  );
  return r.rows;
}

export interface NewProjectForAlert {
  id: number;
  name: string;
  project_type: ProjectType;
  status: string;
  address: string | null;
  neighborhood: string | null;
}

export async function findNewProjectsForSubscription(
  sub: AlertSubscription,
): Promise<NewProjectForAlert[]> {
  const since = sub.last_notified_at ?? new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const r = await query<NewProjectForAlert>(
    `SELECT p.id, p.name, p.project_type, p.status, p.address, p.neighborhood
       FROM civic.projects p
       WHERE p.project_type = ANY($1)
         AND p.first_seen_at > $2
         AND ST_DWithin(
               p.geom,
               ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography,
               $5)
         AND NOT EXISTS (
           SELECT 1 FROM civic.alert_log al
             WHERE al.subscription_id = $6 AND al.project_id = p.id
         )
       ORDER BY p.first_seen_at DESC
       LIMIT 50`,
    [sub.project_types, since, sub.lng, sub.lat, sub.radius_meters, sub.id],
  );
  return r.rows;
}

export async function markAlertsSent(subId: number, projectIds: number[]) {
  if (!projectIds.length) return;
  await query(
    `INSERT INTO civic.alert_log (subscription_id, project_id)
     SELECT $1, x FROM UNNEST($2::bigint[]) AS t(x)
     ON CONFLICT DO NOTHING`,
    [subId, projectIds],
  );
  await query(
    "UPDATE civic.alert_subscriptions SET last_notified_at = NOW() WHERE id = $1",
    [subId],
  );
}
