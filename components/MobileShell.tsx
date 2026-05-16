"use client";

import { useState } from "react";

interface Props {
  sidebar: React.ReactNode;
  children: React.ReactNode;
}

// Responsive shell:
// - md+: fixed 380px sidebar on the left, map fills the rest (the layout
//   we've used all along).
// - sm: map is full-screen. A floating button opens a bottom sheet
//   containing the sidebar. The map area resizes on close (handled
//   inside MapView via window resize listener).
export default function MobileShell({ sidebar, children }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed top-0 left-0 bottom-0 w-[380px] border-r border-[var(--line)] bg-[var(--panel)] flex-col z-10">
        {sidebar}
      </aside>
      <main className="fixed top-0 right-0 bottom-0 left-0 md:left-[380px]">
        {children}
      </main>

      {/* Mobile sheet toggle */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="md:hidden fixed bottom-4 left-1/2 -translate-x-1/2 z-30 bg-[var(--ink)] text-[var(--bg)] text-sm font-medium rounded-full px-5 py-2.5 shadow-lg"
      >
        {open ? "Close" : "Filters & list"}
      </button>

      {/* Mobile bottom sheet */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            className="md:hidden fixed inset-0 bg-black/40 z-20"
          />
          <aside
            className="md:hidden fixed bottom-0 left-0 right-0 top-16 bg-[var(--panel)] border-t border-[var(--line)] rounded-t-2xl z-20 flex flex-col"
          >
            {sidebar}
          </aside>
        </>
      )}
    </>
  );
}
