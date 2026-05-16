import { listProjects } from "@/lib/projects";
import { projectsToRss } from "@/lib/rss";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const districtId = parseInt(id, 10);
  if (!Number.isFinite(districtId)) return new Response("not found", { status: 404 });

  const projects = await listProjects({ districtId }, 50, 0);
  const baseUrl = new URL(req.url).origin;
  const xml = projectsToRss(projects, {
    title: `civic-philly · District ${districtId} latest`,
    description: `New housing, transit, zoning, and capital projects in Philadelphia council district ${districtId}, as soon as we scrape them.`,
    link: `${baseUrl}/districts/${districtId}`,
    selfUrl: `${baseUrl}/districts/${districtId}/feed.xml`,
    baseUrl,
  });
  return new Response(xml, {
    headers: {
      "content-type": "application/rss+xml; charset=utf-8",
      "cache-control": "public, max-age=600, s-maxage=600",
    },
  });
}
