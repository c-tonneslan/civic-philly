// Apply schema.sql + seed_datasources.sql to the database in DATABASE_URL.
//
//   node scripts/migrate.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { config as loadDotenv } from "dotenv";
import pg from "pg";

loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

if (!process.env.DATABASE_URL) {
  console.error("error: DATABASE_URL is not set.");
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const schema = readFileSync(join(here, "..", "db", "schema.sql"), "utf8");
const schemaV2 = readFileSync(join(here, "..", "db", "schema_v2.sql"), "utf8");
const schemaV3 = readFileSync(join(here, "..", "db", "schema_v3.sql"), "utf8");
const schemaV4 = readFileSync(join(here, "..", "db", "schema_v4.sql"), "utf8");
const seed = readFileSync(join(here, "..", "db", "seed_datasources.sql"), "utf8");

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /supabase|neon/.test(process.env.DATABASE_URL) ? { rejectUnauthorized: false } : false,
});

const client = await pool.connect();
try {
  console.log("applying schema...");
  await client.query(schema);
  console.log("applying schema v2 (context, history, follows)...");
  await client.query(schemaV2);
  console.log("applying schema v3 (developer + tsv + rcos)...");
  await client.query(schemaV3);
  console.log("applying schema v4 (owners + violations)...");
  await client.query(schemaV4);
  console.log("seeding datasources...");
  await client.query(seed);
  console.log("done.");
} catch (e) {
  console.error(e);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
