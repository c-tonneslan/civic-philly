import { listProjects } from "@/lib/projects";
import { projectsToRss } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const projects = await listProjects({}, 50, 0);
  const baseUrl = new URL(req.url).origin;
  const xml = projectsToRss(projects, {
    title: "civic-philly · latest projects",
    description: "Every housing development, transit project, zoning permit, and capital investment in Philadelphia, as soon as we scrape it.",
    link: baseUrl,
    selfUrl: `${baseUrl}/feed.xml`,
    baseUrl,
  });
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=600",
    },
  });
}
