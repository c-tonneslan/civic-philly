import { Pool, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __civicPhillyPool: Pool | undefined;
}

function getPool(): Pool {
  if (globalThis.__civicPhillyPool) return globalThis.__civicPhillyPool;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  globalThis.__civicPhillyPool = new Pool({
    connectionString: url,
    ssl: /supabase|neon/.test(url) ? { rejectUnauthorized: false } : false,
    max: 5,
    // Keep our tables in their own schema. On Supabase, PostGIS lives in
    // the `extensions` schema so include it for ST_DWithin etc.
    options: "-c search_path=civic,extensions,public",
  });
  return globalThis.__civicPhillyPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as never);
}
