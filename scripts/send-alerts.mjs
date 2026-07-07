// Send alert emails for every verified subscription. Designed to run on a
// schedule (cron / GitHub Actions) after the scrape pass.
//
//   node scripts/send-alerts.mjs

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
const BASE = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

const TYPE_LABELS = {
  housing: "Housing",
  transit: "Transit",
  zoning: "Zoning",
  infrastructure: "Infrastructure",
};

async function main() {
  const subs = await pool.query(`
    SELECT id, email, address_label, radius_meters, project_types,
           verify_token, unsubscribe_token,
           ST_Y(geom::geometry) AS lat, ST_X(geom::geometry) AS lng,
           last_notified_at
      FROM civic.alert_subscriptions
      WHERE verified = TRUE
  `);

  let totalSent = 0;
  for (const sub of subs.rows) {
    const since = sub.last_notified_at || new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
    const newOnes = await pool.query(`
      SELECT p.id, p.name, p.project_type, p.status, p.address, p.neighborhood
        FROM civic.projects p
       WHERE p.project_type = ANY($1)
         AND p.first_seen_at > $2
         AND ST_DWithin(p.geom, ST_SetSRID(ST_MakePoint($3, $4), 4326)::geography, $5)
         AND NOT EXISTS (
           SELECT 1 FROM civic.alert_log al
             WHERE al.subscription_id = $6 AND al.project_id = p.id
         )
       ORDER BY p.first_seen_at DESC
       LIMIT 50
    `, [sub.project_types, since, sub.lng, sub.lat, sub.radius_meters, sub.id]);

    if (newOnes.rows.length === 0) continue;

    const unsub = `${BASE}/api/alerts/unsubscribe?token=${sub.unsubscribe_token}`;
    const items = newOnes.rows.map((p) =>
      `- [${TYPE_LABELS[p.project_type]}] ${p.name}${p.address ? ` (${p.address})` : ""}\n  ${BASE}/projects/${p.id}`
    ).join("\n");

    const body =
`${newOnes.rows.length} new project${newOnes.rows.length === 1 ? "" : "s"} near ${sub.address_label}:

${items}

You're getting this because you signed up for alerts within ${sub.radius_meters}m of ${sub.address_label}.
Unsubscribe: ${unsub}
`;

    if (resend) {
      try {
        await resend.emails.send({
          from: FROM,
          to: sub.email,
          subject: `${newOnes.rows.length} new project${newOnes.rows.length === 1 ? "" : "s"} near you`,
          text: body,
        });
        totalSent += newOnes.rows.length;
      } catch (e) {
        console.error(`send to ${sub.email} failed:`, e);
        continue;
      }
    } else {
      console.log(`[dry-run] would send to ${sub.email}:\n${body}\n`);
    }

    await pool.query(`
      INSERT INTO civic.alert_log (subscription_id, project_id)
        SELECT $1, x FROM UNNEST($2::bigint[]) AS t(x)
        ON CONFLICT DO NOTHING
    `, [sub.id, newOnes.rows.map((p) => p.id)]);
    await pool.query("UPDATE civic.alert_subscriptions SET last_notified_at = NOW() WHERE id = $1", [sub.id]);
  }

  console.log(`new-project notifications: ${totalSent} across ${subs.rowCount} subscriptions.`);

  // Status-change alerts: for every follow on a project, fire when a
  // new status_history row has appeared since the last notify.
  const followRows = await pool.query(`
    SELECT f.id, f.email, f.unsubscribe_token, f.last_notified_at, f.target_value::bigint AS project_id
      FROM civic.follows f
     WHERE f.verified = TRUE AND f.target_type = 'project'
       -- Defense-in-depth: never let a malformed target_value reach ::bigint and
       -- take down status emails for every follower (the API also enforces this).
       AND f.target_value ~ '^[0-9]+$'
  `);
  let statusSent = 0;
  for (const f of followRows.rows) {
    const since = f.last_notified_at || new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
    const events = await pool.query(`
      SELECT h.id, h.status, h.observed_at, p.name
        FROM civic.status_history h
        JOIN civic.projects p ON p.id = h.project_id
       WHERE h.project_id = $1
         AND h.observed_at > $2
         AND NOT EXISTS (
           SELECT 1 FROM civic.status_alert_log al
            WHERE al.follow_id = $3 AND al.status_history_id = h.id
         )
       ORDER BY h.observed_at ASC
    `, [f.project_id, since, f.id]);
    if (events.rows.length === 0) continue;

    const unsub = `${BASE}/api/alerts/unsubscribe?token=${f.unsubscribe_token}`;
    const projectName = events.rows[0].name;
    const lines = events.rows.map((e) =>
      `  ${e.observed_at.toString().slice(0, 10)}  →  ${e.status}`
    ).join("\n");

    const body =
`Status update on ${projectName}:

${lines}

${BASE}/projects/${f.project_id}

Unsubscribe: ${unsub}
`;
    if (resend) {
      try {
        await resend.emails.send({
          from: FROM, to: f.email,
          subject: `Update: ${projectName}`,
          text: body,
        });
      } catch (e) {
        console.error(`status email to ${f.email} failed:`, e);
        continue;
      }
    } else {
      console.log(`[dry-run] would send status update to ${f.email}:\n${body}\n`);
    }
    for (const e of events.rows) {
      await pool.query(
        `INSERT INTO civic.status_alert_log (follow_id, status_history_id) VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [f.id, e.id],
      );
      statusSent++;
    }
    await pool.query("UPDATE civic.follows SET last_notified_at = NOW() WHERE id = $1", [f.id]);
  }
  console.log(`status-change notifications: ${statusSent}.`);
  await pool.end();
}

main().catch(async (e) => {
  console.error(e);
  await pool.end().catch(() => {});
  process.exit(1);
});
