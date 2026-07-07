"use client";

import { useState } from "react";
import type { FollowTargetType } from "@/lib/follows";

// Compact "Follow" pill for entity page headers. Click reveals an email field;
// on submit it POSTs /api/follows (double opt-in) and shows a check-your-email
// state. Single email input only — no geocoder, unlike the proximity AlertForm.
export default function FollowButton({
  targetType,
  targetValue,
  label,
}: {
  targetType: FollowTargetType;
  targetValue: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!email.includes("@")) { setErr("Enter a valid email."); return; }
    setBusy(true);
    try {
      const resp = await fetch("/api/follows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, targetType, targetValue }),
      });
      if (!resp.ok) {
        const j = await resp.json().catch(() => ({}));
        setErr(j.error || "Something went wrong.");
        return;
      }
      setDone(true);
    } catch {
      setErr("Network error. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <span className="text-xs text-[var(--ink-dim)]">
        Check your email at <span className="text-[var(--ink)]">{email}</span> — the follow starts once you confirm.
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={label ? `Follow ${label}` : "Follow"}
        className="px-3 py-1.5 rounded border border-[var(--line)] text-xs hover:border-[var(--accent)] hover:text-[var(--ink)] transition-colors"
      >
        + Follow
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-1.5">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        autoFocus
        className="bg-[var(--panel-2)] border border-[var(--line)] rounded px-2 py-1.5 text-xs w-44"
      />
      <button
        type="submit"
        disabled={busy}
        className="px-2.5 py-1.5 rounded border border-[var(--line)] text-xs hover:border-[var(--accent)] disabled:opacity-50"
      >
        {busy ? "…" : "Follow"}
      </button>
      {err && <span className="text-[11px] text-red-400">{err}</span>}
    </form>
  );
}
