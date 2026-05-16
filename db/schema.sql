-- civic-philly schema.
-- All geometries are stored as `geography(Point, 4326)` so we can do
-- meters-based ST_DWithin queries without a separate projection step.
--
-- Everything lives in the `civic` schema to keep this project isolated
-- when sharing a database with other projects (e.g. groundwork). Set
-- search_path = civic,public,extensions in the connection options so
-- unqualified table refs and PostGIS functions both resolve correctly.

CREATE SCHEMA IF NOT EXISTS civic;
SET search_path TO civic, public;

-- PostGIS is provided by the host (Supabase puts it in `extensions`).
-- If you're running locally, uncomment the next line:
-- CREATE EXTENSION IF NOT EXISTS postgis;

-- Each row in `datasources` represents one upstream feed we pull from.
-- quality_notes is the free-form blob that the UI surfaces to users on
-- every detail page. Be honest about staleness, gaps, and known issues.
CREATE TABLE IF NOT EXISTS civic.datasources (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  agency          TEXT NOT NULL,
  homepage_url    TEXT,
  feed_url        TEXT,
  license         TEXT,
  description     TEXT,
  quality_notes   TEXT,
  last_fetched_at TIMESTAMPTZ,
  record_count    INTEGER DEFAULT 0,
  status          TEXT DEFAULT 'ok' CHECK (status IN ('ok', 'degraded', 'down'))
);

-- Canonical project table. One row per real-world project regardless of
-- which feed it came from. external_id + datasource_id de-dupe runs.
CREATE TABLE IF NOT EXISTS civic.projects (
  id                BIGSERIAL PRIMARY KEY,
  datasource_id     TEXT NOT NULL REFERENCES civic.datasources(id),
  external_id       TEXT NOT NULL,
  project_type      TEXT NOT NULL CHECK (project_type IN ('housing','transit','zoning','infrastructure')),
  name              TEXT NOT NULL,
  description       TEXT,
  address           TEXT,
  neighborhood      TEXT,
  council_district  TEXT,
  zip_code          TEXT,
  status            TEXT CHECK (status IN ('proposed','approved','under_construction','completed','cancelled','unknown')),
  funding_source    TEXT,
  funding_amount    NUMERIC(14,2),
  units_total       INTEGER,
  units_affordable  INTEGER,
  start_date        DATE,
  completion_date   DATE,
  approved_date     DATE,
  source_url        TEXT,
  raw_attrs         JSONB,
  geom              geography(Point, 4326) NOT NULL,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  first_seen_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (datasource_id, external_id)
);

CREATE INDEX IF NOT EXISTS projects_geom_idx ON civic.projects USING GIST (geom);
CREATE INDEX IF NOT EXISTS projects_type_idx ON civic.projects (project_type);
CREATE INDEX IF NOT EXISTS projects_status_idx ON civic.projects (status);
CREATE INDEX IF NOT EXISTS projects_neighborhood_idx ON civic.projects (neighborhood);
CREATE INDEX IF NOT EXISTS projects_first_seen_idx ON civic.projects (first_seen_at DESC);

-- Email alert subscriptions. Users save an address + radius and get a
-- digest when new projects show up nearby. Token-based confirm, no auth.
CREATE TABLE IF NOT EXISTS civic.alert_subscriptions (
  id              BIGSERIAL PRIMARY KEY,
  email           TEXT NOT NULL,
  address_label   TEXT NOT NULL,
  radius_meters   INTEGER NOT NULL CHECK (radius_meters BETWEEN 100 AND 10000),
  project_types   TEXT[] NOT NULL DEFAULT ARRAY['housing','transit','zoning','infrastructure'],
  verified        BOOLEAN NOT NULL DEFAULT FALSE,
  verify_token    TEXT NOT NULL,
  unsubscribe_token TEXT NOT NULL,
  geom            geography(Point, 4326) NOT NULL,
  last_notified_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (email, address_label)
);

CREATE INDEX IF NOT EXISTS alerts_geom_idx ON civic.alert_subscriptions USING GIST (geom);
CREATE INDEX IF NOT EXISTS alerts_verified_idx ON civic.alert_subscriptions (verified) WHERE verified;

-- Log of every alert we send, so a re-run of the sender doesn't double up.
CREATE TABLE IF NOT EXISTS civic.alert_log (
  id             BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES civic.alert_subscriptions(id) ON DELETE CASCADE,
  project_id     BIGINT NOT NULL REFERENCES civic.projects(id) ON DELETE CASCADE,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, project_id)
);
