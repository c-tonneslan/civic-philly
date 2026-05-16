import type { MetadataRoute } from "next";
import { query } from "@/lib/db";

const BASE = process.env.NEXT_PUBLIC_BASE_URL || "https://civic-philly.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Pull every project ID + districts + developers + owners so search
  // engines can find them. Caps at 50k entries (Google's per-sitemap
  // limit) — we have way fewer than that.
  const projects = await query<{ id: string; first_seen_at: string }>(
    `SELECT id::text, first_seen_at FROM civic.projects ORDER BY id LIMIT 50000`,
  ).then((r) => r.rows).catch(() => []);

  const developers = await query<{ developer: string }>(
    `SELECT DISTINCT developer FROM civic.projects WHERE developer IS NOT NULL`,
  ).then((r) => r.rows).catch(() => []);

  const owners = await query<{ owner_1: string }>(
    `SELECT DISTINCT owner_1 FROM civic.property_owners WHERE owner_1 IS NOT NULL LIMIT 5000`,
  ).then((r) => r.rows).catch(() => []);

  const now = new Date();

  const staticPaths: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, priority: 1.0 },
    { url: `${BASE}/this-week`, lastModified: now, priority: 0.9, changeFrequency: "daily" },
    { url: `${BASE}/districts`, lastModified: now, priority: 0.8 },
    { url: `${BASE}/developers`, lastModified: now, priority: 0.7 },
    { url: `${BASE}/owners`, lastModified: now, priority: 0.7 },
    { url: `${BASE}/stalled`, lastModified: now, priority: 0.7 },
    { url: `${BASE}/data`, lastModified: now, priority: 0.6 },
    { url: `${BASE}/methodology`, lastModified: now, priority: 0.6 },
    { url: `${BASE}/alerts`, lastModified: now, priority: 0.5 },
  ];

  const districtPaths: MetadataRoute.Sitemap = Array.from({ length: 10 }, (_, i) => ({
    url: `${BASE}/districts/${i + 1}`,
    lastModified: now,
    priority: 0.7,
    changeFrequency: "daily" as const,
  }));

  const projectPaths: MetadataRoute.Sitemap = projects.map((p) => ({
    url: `${BASE}/projects/${p.id}`,
    lastModified: p.first_seen_at ? new Date(p.first_seen_at) : now,
    priority: 0.5,
  }));

  const developerPaths: MetadataRoute.Sitemap = developers.map((d) => ({
    url: `${BASE}/developers/${encodeURIComponent(d.developer)}`,
    lastModified: now,
    priority: 0.4,
  }));

  const ownerPaths: MetadataRoute.Sitemap = owners.map((o) => ({
    url: `${BASE}/owners/${encodeURIComponent(o.owner_1)}`,
    lastModified: now,
    priority: 0.3,
  }));

  return [...staticPaths, ...districtPaths, ...projectPaths, ...developerPaths, ...ownerPaths];
}
