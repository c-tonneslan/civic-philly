// Weekly per-district digest. Fires every Sunday (via GitHub Actions cron).
// Sends a "what changed in district N this week" email to anyone who
// follows a district. Pulls new projects + status changes + new
// demolitions, all scoped to the district.
//
//   node scripts/send-digest.mjs

import { config as loadDotenv } from "dotenv";
import pg from "pg";
import { Resend } from "resend";

loadDotenv({ path: ".env.local" });
loadDotenv({ path: ".env" });

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: /supabase|neon/.test(process.env.DATABASE_URL || "") ? { rejectUnauthorized: false } : false,
});

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM = process.env.ALERT_FROM_EMAIL || "alerts@civic-philly.local";
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://civic-philly.vercel.app";

async function buildDigestForDistrict(districtId, sinceIso) {
  const newProjects = await pool.query(`
    SELECT id, name, project_type, status, address
      FROM civic.projects
     WHERE council_district_id = $1
       AND first_seen_at > $2
     ORDER BY first_seen_at DESC
     LIMIT 30
  `, [districtId, sinceIso]);

  const statusChanges = await pool.query(`
    SELECT p.id, p.name, p.project_type, h.status, h.observed_at
      FROM civic.status_history h
      JOIN civic.projects p ON p.id = h.project_id
     WHERE p.council_district_id = $1
       AND h.observed_at > $2
       AND h.status NOT IN ('unknown')
     ORDER BY h.observed_at DESC
     LIMIT 30
  `, [districtId, sinceIso]);

  const newDemolitions = await pool.query(`
    SELECT COUNT(*)::int AS n
      FROM civic.displacement_signals ds
     WHERE event_date > $1
       AND EXISTS (
         SELECT 1 FROM civic.council_districts d
          WHERE d.id = $2 AND ST_Intersects(ds.geom, d.geom)
       )
  `, [sinceIso, districtId]);

  if (newProjects.rows.length === 0 && statusChanges.rows.length === 0) return null;

  const lines = [];
  lines.push(`What changed in District ${districtId} this week`);
  lines.push("");

  if (newProjects.rows.length) {
    lines.push(`${newProjects.rows.length} new project${newProjects.rows.length === 1 ? "" : "s"}:`);
    for (const p of newProjects.rows.slice(0, 8)) {
      lines.push(`  - [${p.project_type}] ${p.name}${p.address ? ` (${p.address})` : ""}`);
      lines.push(`      ${BASE}/projects/${p.id}`);
    }
    if (newProjects.rows.length > 8) lines.push(`  ...and ${newProjects.rows.length - 8} more`);
    lines.push("");
  }
  if (statusChanges.rows.length) {
    lines.push(`${statusChanges.rows.length} status change${statusChanges.rows.length === 1 ? "" : "s"}:`);
    for (const s of statusChanges.rows.slice(0, 8)) {
      lines.push(`  - ${s.name} → ${s.status}`);
    }
    if (statusChanges.rows.length > 8) lines.push(`  ...and ${statusChanges.rows.length - 8} more`);
    lines.push("");
  }
  if (newDemolitions.rows[0].n > 0) {
    lines.push(`${newDemolitions.rows[0].n} new demolition permit${newDemolitions.rows[0].n === 1 ? "" : "s"} in the district.`);
    lines.push("");
  }
  lines.push(`District briefing: ${BASE}/districts/${districtId}`);
  return lines.join("\n");
}

async function buildDigestForDeveloper(developerName, sinceIso) {
  const newProjects = await pool.query(`
    SELECT id, name, project_type, status, address
      FROM civic.projects
     WHERE developer = $1
       AND first_seen_at > $2
     ORDER BY first_seen_at DESC
     LIMIT 30
  `, [developerName, sinceIso]);

  const statusChanges = await pool.query(`
    SELECT p.id, p.name, p.project_type, h.status, h.observed_at
      FROM civic.status_history h
      JOIN civic.projects p ON p.id = h.project_id
     WHERE p.developer = $1
       AND h.observed_at > $2
       AND h.status NOT IN ('unknown')
     ORDER BY h.observed_at DESC
     LIMIT 30
  `, [developerName, sinceIso]);

  if (newProjects.rows.length === 0 && statusChanges.rows.length === 0) return null;

  const lines = [];
  lines.push(`What changed for ${developerName} this week`);
  lines.push("");
  if (newProjects.rows.length) {
    lines.push(`${newProjects.rows.length} new project${newProjects.rows.length === 1 ? "" : "s"}:`);
    for (const p of newProjects.rows.slice(0, 8)) {
      lines.push(`  - [${p.project_type}] ${p.name}${p.address ? ` (${p.address})` : ""}`);
      lines.push(`      ${BASE}/projects/${p.id}`);
    }
    if (newProjects.rows.length > 8) lines.push(`  ...and ${newProjects.rows.length - 8} more`);
    lines.push("");
  }
  if (statusChanges.rows.length) {
    lines.push(`${statusChanges.rows.length} status change${statusChanges.rows.length === 1 ? "" : "s"}:`);
    for (const s of statusChanges.rows.slice(0, 8)) {
      lines.push(`  - ${s.name} → ${s.status}`);
    }
    if (statusChanges.rows.length > 8) lines.push(`  ...and ${statusChanges.rows.length - 8} more`);
    lines.push("");
  }
  lines.push(`Developer page: ${BASE}/developers/${encodeURIComponent(developerName)}`);
  return lines.join("\n");
}

async function main() {
  const since = new Date();
  since.setDate(since.getDate() - 7);
  const sinceIso = since.toISOString();

  const follows = await pool.query(`
    SELECT id, email, unsubscribe_token, target_value, target_type
      FROM civic.follows
     WHERE verified = TRUE AND target_type IN ('district', 'developer')
  `);
  console.log(`found ${follows.rows.length} district/developer followers`);

  // NOTE: project follows are delivered in real time by send-alerts.mjs (deduped
  // via status_alert_log) — deliberately NOT handled here, to avoid double-notify.
  let totalSent = 0;
  for (const f of follows.rows) {
    let body;
    let subject;
    if (f.target_type === "district") {
      const districtId = parseInt(f.target_value, 10);
      if (!Number.isFinite(districtId)) continue;
      body = await buildDigestForDistrict(districtId, sinceIso);
      subject = `civic-philly weekly: District ${districtId}`;
    } else {
      body = await buildDigestForDeveloper(f.target_value, sinceIso);
      subject = `civic-philly weekly: ${f.target_value}`;
    }
    if (!body) continue;

    const text = body + `\n\nUnsubscribe: ${BASE}/api/alerts/unsubscribe?token=${f.unsubscribe_token}\n`;
    if (resend) {
      try {
        await resend.emails.send({ from: FROM, to: f.email, subject, text });
        totalSent++;
      } catch (e) {
        console.error(`digest to ${f.email} failed:`, e);
      }
    } else {
      console.log(`[dry-run] would send digest to ${f.email}:\n${text}\n`);
      totalSent++;
    }
  }
  console.log(`sent ${totalSent} digests.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
