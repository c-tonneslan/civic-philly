import { NextResponse } from "next/server";

export const dynamic = "force-static";

// Discovery endpoint. Returns the catalog of available API resources.
// Designed to be readable as documentation in a browser too.
export function GET() {
  return NextResponse.json({
    name: "civic-philly API v1",
    description: "Public read-only API over the civic-philly project dataset.",
    license: "Public domain (data) / MIT (code).",
    citation: "civic-philly (civic-philly.vercel.app)",
    methodology: "https://civic-philly.vercel.app/methodology",
    resources: {
      projects: {
        url: "/api/v1/projects",
        method: "GET",
        params: {
          type: "housing | transit | zoning | infrastructure (repeatable)",
          status: "proposed | approved | under_construction | completed | cancelled (repeatable)",
          district: "integer 1-10",
          neighborhood: "string (exact match, case-insensitive)",
          funding: "substring match against funding_source",
          developer: "exact match against developer (URL-encoded)",
          q: "free-text search across name, address, description, developer",
          startYear: "integer (inclusive lower bound on approved/start dates)",
          endYear: "integer (inclusive upper bound on completion/start dates)",
          lat: "float (with lng + radius for near-me)",
          lng: "float",
          radius: "integer meters",
          limit: "1-500 (default 100)",
          offset: "integer (default 0)",
        },
        example: "/api/v1/projects?type=housing&district=3&limit=50",
      },
      tracts_choropleth: {
        url: "/api/overlays/tracts",
        method: "GET",
        params: {
          metric: "rent_burdened | renter | income | white | black | hispanic | asian",
        },
        returns: "GeoJSON FeatureCollection of census tracts with the chosen value.",
      },
      demolitions: {
        url: "/api/overlays/demolitions",
        method: "GET",
        returns: "GeoJSON FeatureCollection of L&I demolition permits, last 3 years.",
      },
      export_csv: {
        url: "/api/export.csv",
        method: "GET",
        params: "Same as /api/v1/projects.",
        returns: "text/csv",
      },
    },
  });
}
