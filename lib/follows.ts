import { token } from "./alerts";
import { query } from "./db";

// No-account "follow" for a developer, project, or district. Mirrors the alert
// subscription flow (double opt-in, token verify/unsubscribe, per-email throttle)
// but keyed on civic.follows. Real-time project follows are delivered by
// scripts/send-alerts.mjs; developer/district follows by scripts/send-digest.mjs.
export type FollowTargetType = "project" | "developer" | "district";

export interface Follow {
  id: number;
  email: string;
  target_type: FollowTargetType;
  target_value: string;
  verify_token: string;
  unsubscribe_token: string;
}

// Anti-mailbomb throttle, case-insensitive like lib/alerts.ts recentUnverifiedCount.
export async function recentUnverifiedFollowCount(email: string): Promise<number> {
  const r = await query<{ n: string }>(
    `SELECT COUNT(*)::text AS n
       FROM civic.follows
      WHERE lower(email) = lower($1)
        AND verified = FALSE
        AND created_at > NOW() - INTERVAL '1 hour'`,
    [email],
  );
  return Number(r.rows[0]?.n ?? 0);
}

export async function createFollow(input: {
  email: string;
  targetType: FollowTargetType;
  targetValue: string;
}): Promise<Follow> {
  const verify = token();
  const unsub = token();
  const r = await query<Follow>(
    `INSERT INTO civic.follows
       (email, target_type, target_value, verified, verify_token, unsubscribe_token)
     VALUES ($1, $2, $3, FALSE, $4, $5)
     ON CONFLICT (email, target_type, target_value) DO UPDATE
       -- Preserve an already-confirmed follow: don't let a re-POST un-verify it
       -- or rotate its token (same guard as alert subscriptions).
       SET verify_token = CASE WHEN follows.verified THEN follows.verify_token ELSE EXCLUDED.verify_token END,
           verified = follows.verified
     RETURNING id, email, target_type, target_value, verify_token, unsubscribe_token`,
    [input.email, input.targetType, input.targetValue, verify, unsub],
  );
  return r.rows[0];
}

export async function verifyFollow(verifyToken: string): Promise<Follow | null> {
  const r = await query<Follow>(
    `UPDATE civic.follows SET verified = TRUE
      WHERE verify_token = $1
     RETURNING id, email, target_type, target_value, verify_token, unsubscribe_token`,
    [verifyToken],
  );
  return r.rows[0] ?? null;
  // Unsubscribe is handled by lib/alerts.ts unsubscribe(), which already deletes
  // from civic.follows by token — no separate implementation needed here.
}

export function describeFollowTarget(t: FollowTargetType, v: string): string {
  if (t === "district") return `City Council District ${v}`;
  if (t === "developer") return v;
  return `project #${v}`;
}
