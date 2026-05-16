import { query } from "./db";
import type { Datasource } from "./types";

export async function listDatasources(): Promise<Datasource[]> {
  const r = await query<Datasource>(
    `SELECT id, name, agency, homepage_url, feed_url, license, description,
            quality_notes, last_fetched_at, record_count, status
       FROM civic.datasources
       ORDER BY name`,
  );
  return r.rows;
}

export async function getDatasource(id: string): Promise<Datasource | null> {
  const r = await query<Datasource>(
    `SELECT id, name, agency, homepage_url, feed_url, license, description,
            quality_notes, last_fetched_at, record_count, status
       FROM civic.datasources WHERE id = $1`,
    [id],
  );
  return r.rows[0] ?? null;
}
