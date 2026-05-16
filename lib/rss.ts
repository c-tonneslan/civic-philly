import type { Project } from "./types";
import { TYPE_LABELS, STATUS_LABELS } from "./types";

function esc(s: string | null | undefined): string {
  if (s == null) return "";
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export interface RssOptions {
  title: string;
  description: string;
  link: string;
  selfUrl: string;
  baseUrl: string;
}

export function projectsToRss(projects: Project[], opts: RssOptions): string {
  const now = new Date().toUTCString();
  const items = projects.map((p) => {
    const link = `${opts.baseUrl}/projects/${p.id}`;
    const pubDate = new Date(p.first_seen_at).toUTCString();
    const typeLabel = TYPE_LABELS[p.project_type];
    const statusLabel = STATUS_LABELS[p.status];
    const summary = [
      `${typeLabel} project, ${statusLabel.toLowerCase()}.`,
      p.address && `Address: ${p.address}.`,
      p.developer && `Developer: ${p.developer}.`,
      p.council_district_id && `District ${p.council_district_id}.`,
      p.funding_amount && `Funding: $${Number(p.funding_amount).toLocaleString()}.`,
      p.units_total && `${p.units_total} units.`,
    ].filter(Boolean).join(" ");
    return `    <item>
      <title>${esc(p.name)}</title>
      <link>${esc(link)}</link>
      <guid isPermaLink="true">${esc(link)}</guid>
      <pubDate>${pubDate}</pubDate>
      <description>${esc(summary)}</description>
      <category>${esc(typeLabel)}</category>
    </item>`;
  }).join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(opts.title)}</title>
    <link>${esc(opts.link)}</link>
    <description>${esc(opts.description)}</description>
    <language>en-us</language>
    <lastBuildDate>${now}</lastBuildDate>
    <atom:link href="${esc(opts.selfUrl)}" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;
}
