-- Schema v2 additions: context layers and accountability tracking.
--
-- Goal: lift the app from "what's near me?" to "what does this mean?"
-- - status_history captures every status change so we can show stalled
--   projects and promises vs delivery
-- - council_districts + elected_officials let every project carry
--   accountability context
-- - census_tracts + acs_5y populates the equity overlay (rent burden,
--   income, race, ownership)
-- - evictions overlays the displacement signal next to new construction
-- - follows is the long-running interest layer (developer, project)

SET search_path TO civic, public;

CREATE TABLE IF NOT EXISTS civic.status_history (
  id            BIGSERIAL PRIMARY KEY,
  project_id    BIGINT NOT NULL REFERENCES civic.projects(id) ON DELETE CASCADE,
  status        TEXT NOT NULL,
  observed_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS status_history_project_idx ON civic.status_history (project_id, observed_at DESC);

CREATE TABLE IF NOT EXISTS civic.council_districts (
  id          INTEGER PRIMARY KEY,
  name        TEXT NOT NULL,
  geom        geography(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS council_districts_geom_idx ON civic.council_districts USING GIST (geom);

CREATE TABLE IF NOT EXISTS civic.elected_officials (
  id              SERIAL PRIMARY KEY,
  role            TEXT NOT NULL CHECK (role IN ('council_district','council_at_large','mayor')),
  district_id     INTEGER REFERENCES civic.council_districts(id),
  name            TEXT NOT NULL,
  party           TEXT,
  email           TEXT,
  phone           TEXT,
  office_address  TEXT,
  website         TEXT,
  twitter         TEXT
);
CREATE INDEX IF NOT EXISTS officials_district_idx ON civic.elected_officials (district_id);

CREATE TABLE IF NOT EXISTS civic.census_tracts (
  geoid           TEXT PRIMARY KEY,
  name            TEXT,
  total_pop       INTEGER,
  median_hh_income INTEGER,
  pct_rent_burdened NUMERIC(5,2),
  pct_renter      NUMERIC(5,2),
  pct_white       NUMERIC(5,2),
  pct_black       NUMERIC(5,2),
  pct_hispanic    NUMERIC(5,2),
  pct_asian       NUMERIC(5,2),
  acs_year        INTEGER,
  geom            geography(MultiPolygon, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS tracts_geom_idx ON civic.census_tracts USING GIST (geom);

-- Displacement signals: events that suggest housing stock loss or
-- pressure. We started with eviction filings but Philadelphia doesn't
-- publish them as open data, so we use demolition permits as a proxy:
-- when L&I issues a Demolition permit, residents lose units. The detail
-- page is clear about what this measures and what it doesn't.
CREATE TABLE IF NOT EXISTS civic.displacement_signals (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT NOT NULL CHECK (source IN ('demolition_permit')),
  external_id     TEXT NOT NULL,
  event_date      DATE NOT NULL,
  address         TEXT,
  description     TEXT,
  geom            geography(Point, 4326) NOT NULL,
  UNIQUE (source, external_id)
);
CREATE INDEX IF NOT EXISTS displacement_geom_idx ON civic.displacement_signals USING GIST (geom);
CREATE INDEX IF NOT EXISTS displacement_date_idx ON civic.displacement_signals (event_date DESC);

CREATE TABLE IF NOT EXISTS civic.follows (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  target_type     TEXT NOT NULL CHECK (target_type IN ('project','developer','district')),
  target_value    TEXT NOT NULL,
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token    TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL,
  last_notified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, target_type, target_value)
);
CREATE INDEX IF NOT EXISTS follows_target_idx ON civic.follows (target_type, target_value);

-- Add denormalized spatial-join columns onto projects so per-row lookups
-- don't need a polygon join at read time. Filled by backfill script.
ALTER TABLE civic.projects ADD COLUMN IF NOT EXISTS council_district_id INTEGER;
ALTER TABLE civic.projects ADD COLUMN IF NOT EXISTS census_tract_geoid TEXT;
CREATE INDEX IF NOT EXISTS projects_council_district_idx ON civic.projects (council_district_id);
CREATE INDEX IF NOT EXISTS projects_tract_idx ON civic.projects (census_tract_geoid);

-- Aggregate roll-up materialized view, refreshed after every scrape.
-- The point: a council aide gets the brief without touching the map.
CREATE OR REPLACE VIEW civic.district_stats AS
SELECT
  d.id                                        AS district_id,
  d.name                                      AS district_name,
  COUNT(p.id)                                 AS total_projects,
  COUNT(*) FILTER (WHERE p.project_type = 'housing')                                       AS housing_projects,
  COUNT(*) FILTER (WHERE p.project_type = 'transit')                                       AS transit_projects,
  COUNT(*) FILTER (WHERE p.project_type = 'zoning')                                        AS zoning_projects,
  COUNT(*) FILTER (WHERE p.project_type = 'infrastructure')                                AS infrastructure_projects,
  COUNT(*) FILTER (WHERE p.status = 'under_construction')                                  AS active_projects,
  COUNT(*) FILTER (WHERE p.status = 'proposed' OR p.status = 'approved')                   AS pipeline_projects,
  COUNT(*) FILTER (WHERE p.status = 'completed')                                           AS completed_projects,
  SUM(p.units_total) FILTER (WHERE p.project_type = 'housing')                             AS housing_units_total,
  SUM(p.units_affordable) FILTER (WHERE p.project_type = 'housing')                        AS housing_units_affordable,
  SUM(p.funding_amount)                                                                    AS total_funding_amount
FROM civic.council_districts d
LEFT JOIN civic.projects p ON p.council_district_id = d.id
GROUP BY d.id, d.name
ORDER BY d.id;
