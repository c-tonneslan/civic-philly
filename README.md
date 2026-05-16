# civic-philly

A map-first interface to every active housing development, transit project, zoning change, and capital infrastructure investment in Philadelphia. The point: a citizen, journalist, organizer, or staffer should be able to open this and understand what's happening on their block in 30 seconds.

Most civic data sites are unusable. This one leans on UX.

## What's in it

- **Map** with clustered markers at zoom-out, color-coded by project type (housing, transit, zoning, infrastructure). Click a marker for a popup; click through for the full project page.
- **Filters** by project type, status (proposed / approved / under construction / completed), neighborhood, funding source, and timeline.
- **"What's near me"** address lookup with radius from 5-minute walk up to 5 km. Drops you straight to the projects within that ring.
- **Email alerts** when new projects show up inside a saved radius. No account, token-based confirm and unsubscribe.
- **Data quality notes** on every datasource: staleness, gaps, geocoding quirks, manual curation, all documented honestly.

## Data sources

- City of Philadelphia Affordable Housing Production (OpenDataPhilly / ArcGIS)
- ZBA Decisions (OpenDataPhilly / ArcGIS, last 5 years)
- City Capital Program Projects (OpenDataPhilly / ArcGIS)
- SEPTA capital projects (hand-curated from the FY26 capital budget book; SEPTA doesn't publish a machine-readable list)

Each one has its own quality notes panel describing what to trust and what to question.

## Stack

- **Next.js 16** App Router + React 19, TypeScript, Tailwind v4
- **MapLibre GL** for the map (no API key required with the default OpenFreeMap style)
- **Postgres + PostGIS** for storage and geo queries (Supabase or Neon both work)
- **Resend** for transactional alert emails
- **Node** scrapers, runs on a daily cron via GitHub Actions

## Local setup

1. Install:
   ```
   npm install
   ```
2. Bring up Postgres with PostGIS. With Docker:
   ```
   docker run --name civic-philly-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 -d postgis/postgis:16-3.4
   createdb -h localhost -U postgres civic_philly
   ```
   Or use a Supabase/Neon project (PostGIS is on by default).
3. Copy `.env.example` to `.env.local` and fill in `DATABASE_URL` plus, optionally, `RESEND_API_KEY` and `ALERT_FROM_EMAIL`.
4. Apply schema and seed the data source registry:
   ```
   npm run db:migrate
   ```
5. Load some data:
   ```
   npm run scrape:all
   ```
   This pulls housing, zoning, infrastructure, and the curated SEPTA list. Takes 1-2 minutes.
6. Run the dev server:
   ```
   npm run dev
   ```
   Open http://localhost:3000.

## Deploying

Vercel + Supabase (or Neon) is the path of least resistance:

1. Push to GitHub.
2. Create a Supabase or Neon project, copy the connection string. Make sure `?sslmode=require` is in it.
3. In Vercel, import the repo. Set env vars: `DATABASE_URL`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `NEXT_PUBLIC_BASE_URL`.
4. After the first deploy, run `npm run db:migrate` once against the prod DB (use a local shell with `DATABASE_URL` pointing at prod, or just paste `db/schema.sql` + `db/seed_datasources.sql` into the Supabase SQL editor).
5. Add the GitHub Actions secrets so the daily scrape + alert job can run: `DATABASE_URL`, `RESEND_API_KEY`, `ALERT_FROM_EMAIL`, `PUBLIC_BASE_URL`. The workflow in `.github/workflows/scrape.yml` fires at 7am ET every day.

## Project layout

```
app/                    # Next.js App Router pages and API routes
  page.tsx              # map + sidebar
  projects/[id]/        # project detail
  data/                 # data quality notes
  alerts/               # email alert signup + verify/unsub landing pages
  api/alerts/           # POST signup, GET verify, GET unsubscribe
components/             # MapView, MiniMap, Sidebar, NearMe, AlertForm
lib/                    # db, queries, types, alert helpers, email
scripts/                # scrapers + migrate + alert sender
db/                     # schema.sql + seed_datasources.sql
data/                   # hand-curated JSON (SEPTA capital list)
```

## Why this exists

Philadelphia publishes a lot of civic data, but most of it sits in dataset listings nobody finds. If you want to know what's being built near your house, you currently need to know:

- which ArcGIS feature server to query
- where the SEPTA capital budget PDFs live
- which OpenDataPhilly dataset has the field you need
- and how to spatially join all of it

This site does that work once, in the open, and surfaces the result as something you can use in 30 seconds.

## License

Data is public domain (City of Philadelphia / SEPTA). Code is MIT.
