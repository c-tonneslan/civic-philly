"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

// The rich accountability pages (stalled, transfers, developers, owners, …)
// used to be reachable only from a row of cryptic 11px links in the map
// sidebar footer, and only on the home route. This persistent nav makes every
// page reachable from every page.
const LINKS: { href: string; label: string }[] = [
  { href: "/", label: "Map" },
  { href: "/this-week", label: "This week" },
  { href: "/districts", label: "Districts" },
  { href: "/developers", label: "Developers" },
  { href: "/owners", label: "Owners" },
  { href: "/transfers", label: "Transfers" },
  { href: "/stalled", label: "Stalled" },
  { href: "/displacement", label: "Displacement" },
  { href: "/data", label: "Data" },
  { href: "/methodology", label: "Methodology" },
];

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function SiteNav() {
  const pathname = usePathname() || "/";
  const [open, setOpen] = useState(false);

  return (
    <nav
      className="sticky top-0 z-50 flex items-center gap-1 border-b border-[var(--line)] bg-[var(--bg)]/95 px-3 backdrop-blur"
      style={{ height: "var(--nav-h)" }}
    >
      <Link href="/" className="mr-2 flex items-center gap-2 shrink-0" onClick={() => setOpen(false)}>
        <span className="h-2 w-2 rounded-full bg-[var(--accent)]" aria-hidden />
        <span className="t-title text-[15px]">civic-philly</span>
      </Link>

      {/* Desktop links */}
      <div className="hidden md:flex items-center gap-0.5 overflow-x-auto">
        {LINKS.slice(1).map((l) => {
          const active = isCurrent(pathname, l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`rounded px-2.5 py-1.5 t-meta whitespace-nowrap transition-colors ${
                active
                  ? "text-[var(--accent)]"
                  : "hover:text-[var(--ink)] hover:bg-[var(--panel-2)]"
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>

      <div className="flex-1" />

      <Link
        href="/alerts"
        className="hidden sm:inline-flex items-center rounded border border-[var(--line)] px-2.5 py-1.5 t-meta hover:border-[var(--accent)] hover:text-[var(--ink)] transition-colors"
      >
        Get alerts
      </Link>

      {/* Mobile menu button */}
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="md:hidden ml-1 inline-flex h-9 w-9 items-center justify-center rounded border border-[var(--line)]"
      >
        <span className="text-lg leading-none">{open ? "×" : "≡"}</span>
      </button>

      {/* Mobile dropdown */}
      {open && (
        <div className="absolute left-0 right-0 top-full md:hidden border-b border-[var(--line)] bg-[var(--bg)] px-3 py-2 grid grid-cols-2 gap-1">
          {LINKS.map((l) => {
            const active = isCurrent(pathname, l.href);
            return (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className={`rounded px-3 py-2.5 t-body ${
                  active ? "is-active" : "hover:bg-[var(--panel-2)]"
                }`}
              >
                {l.label}
              </Link>
            );
          })}
          <Link
            href="/alerts"
            onClick={() => setOpen(false)}
            className="col-span-2 rounded border border-[var(--line)] px-3 py-2.5 t-body text-center hover:border-[var(--accent)]"
          >
            Get alerts
          </Link>
        </div>
      )}
    </nav>
  );
}
