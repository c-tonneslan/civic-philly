# civic-philly

A map-first interface to every active housing development, transit project, zoning change, and capital infrastructure investment in Philadelphia. The point: a council aide writing a brief, a journalist chasing a story, or an organizer prepping for a community meeting should be able to use this and walk away with something they can act on, not just look at.

Live at **[civic-philly.vercel.app](https://civic-philly.vercel.app)**.

## What it does

**The map.** 5,000+ projects across four feeds, clustered, color-coded by type, filterable by neighborhood, council district, status, funding source, and time range. Address lookup with radius search ("show me everything within a 10-minute walk").

**Equity overlay.** Toggle a census-tract choropleth showing rent burden, renter share, median income, or racial composition (ACS 5-year 2022). Every project sits in context: a 200-unit affordable build in a tract where 62% of renters are cost-burdened is a different story than the same project in a tract where 12% are.

**Displacement signal.** Toggle a layer of L&I demolition permits, last 3 years. Philly doesn't publish eviction filings as open data, so this is the closest legitimate proxy for housing stock loss. The UI is honest about that.

**Council district briefs.** Per-district aggregations: pipeline projects, units approved, capital flowing in, contact info for the council member. The page a staffer quotes from.

**Project detail with context.** Every project page shows: the council rep with contact info, the census tract demographics, sibling projects within 400m, demolition permits within 400m, and a status timeline (so when a "proposed" project sits at "proposed" for 18 months, you can see it).

**Stalled projects view.** Anything approved or proposed for more than 365 days that never moved. The accountability tracker. Builds up as the scrape pipeline keeps snapshotting status changes.

**Tooling.**
- One-click CSV export of any filtered view.
- `/embed` route: chrome-less map for iframes. Drop into a CDC site, a journalist blog, a campaign page.
- Email alerts when new projects land within a saved radius (token-based confirm, no account).
- Honest "data quality" panel on every source listing staleness, gaps, and known issues.

## Data sources

| Source | Records | Notes |
|---|---|---|
| OpenDataPhilly Affordable Housing Production (ArcGIS) | ~470 | Quarterly |
| OpenDataPhilly L&I Zoning Permits (Carto SQL) | ~5,000 | Last 2 years |
| SEPTA Capital Budget | 7 | Hand-curated from FY26 budget book; no machine-readable feed exists |
| City Capital Infrastructure | 8 | Hand-curated from CIP; the OpenDataPhilly dataset 404s |
| Census ACS 5-year 2022 | 408 tracts | Boundaries from TIGER, values from Census API |
| Philadelphia Council District boundaries | 10 | ArcGIS |
| Elected officials (council + mayor) | 18 | Hand-curated with contact info |
| L&I Demolition permits | ~1,400 | Last 3 years, displacement proxy |

Daily scrape via GitHub Actions: scrape every feed, snapshot status changes for accountability tracking, run the spatial backfill, send pending email alerts.

## Stack

- **Next.js 16** App Router + React 19, TypeScript, Tailwind v4
- **MapLibre GL** for the map (no API key, default OpenFreeMap style)
- **Postgres + PostGIS** on Supabase (transaction pooler for serverless)
- **Resend** for transactional alerts
- **Node** loaders + scrapers, daily on GitHub Actions
- Deployed on Vercel

The data lives in a dedicated `civic` schema in PostGIS, geographies use `geography(Point,4326)` so radius queries are meters-native. Every query is schema-qualified so this project can share a Supabase project with other PostGIS apps without colliding.

## Local setup

```bash
git clone https://github.com/c-tonneslan/civic-philly
cd civic-philly
npm install
cp .env.example .env.local   # set DATABASE_URL and CENSUS_API_KEY
npm run db:migrate
node scripts/load-districts.mjs
node scripts/load-census.mjs
node scripts/load-officials.mjs
npm run scrape:all
node scripts/load-displacement.mjs
node scripts/backfill-spatial.mjs
npm run dev
```

## Deploy

Vercel + Supabase. Make sure `DATABASE_URL` points at the Supabase **transaction pooler** (port 6543) for serverless connection reuse. The session pooler (5432) maxes out under Vercel concurrency.

## Why

Philadelphia publishes a lot of civic data, but most of it sits in dataset listings nobody finds. If you want to know what's being built near your house, who to call about it, and whether the city is keeping its promises, you currently need to know:

- which ArcGIS feature server to query
- where SEPTA's capital budget PDFs live
- how to spatially join everything against the census
- which OpenDataPhilly dataset still exists vs has been quietly retired

This site does that work once, in the open, and surfaces the result as something a regular person can act on.

## License

Data is public domain (City of Philadelphia, SEPTA, US Census). Code is MIT.
