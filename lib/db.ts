import { Pool, types, type QueryResult, type QueryResultRow } from "pg";

// pg parses DATE (OID 1082) and TIMESTAMPTZ (OID 1184) into JS Date
// objects by default. That breaks JSX rendering on the server when the
// raw value gets passed to React as a child. Keep them as ISO-ish strings
// so they pass through cleanly. Pages format for display as needed.
types.setTypeParser(1082, (val) => val);
types.setTypeParser(1114, (val) => val);
types.setTypeParser(1184, (val) => val);

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
    // Vercel serverless: small pool, fast turnover. The Supabase transaction
    // pooler (port 6543) closes connections between queries, so don't keep
    // many around.
    max: 3,
    idleTimeoutMillis: 10_000,
  });
  return globalThis.__civicPhillyPool;
}

export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params as never);
}
