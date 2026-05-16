-- civic-philly schema.
-- All geometries are stored as `geography(Point, 4326)` so we can do
-- meters-based ST_DWithin queries without a separate projection step.

CREATE EXTENSION IF NOT EXISTS postgis;

-- Each row in `datasources` represents one upstream feed we pull from.
-- We store provenance + a free-form quality_notes blob that the UI surfaces
-- to users on every detail page. The point is to be transparent about
-- staleness, gaps, and known issues rather than hide them.
CREATE TABLE IF NOT EXISTS datasources (
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
-- which feed it came from. external_id + datasource_id are how we de-dupe
-- on subsequent runs. project_type is the broad category (housing,
-- transit, zoning, infrastructure) that drives map color and filtering.
CREATE TABLE IF NOT EXISTS projects (
  id                BIGSERIAL PRIMARY KEY,
  datasource_id     TEXT NOT NULL REFERENCES datasources(id),
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

CREATE INDEX IF NOT EXISTS projects_geom_idx ON projects USING GIST (geom);
CREATE INDEX IF NOT EXISTS projects_type_idx ON projects (project_type);
CREATE INDEX IF NOT EXISTS projects_status_idx ON projects (status);
CREATE INDEX IF NOT EXISTS projects_neighborhood_idx ON projects (neighborhood);
CREATE INDEX IF NOT EXISTS projects_first_seen_idx ON projects (first_seen_at DESC);

-- Email alert subscriptions. Users save an address + radius and get a
-- digest when new projects show up nearby. The verification flow is
-- token-based, no auth required.
CREATE TABLE IF NOT EXISTS alert_subscriptions (
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

CREATE INDEX IF NOT EXISTS alerts_geom_idx ON alert_subscriptions USING GIST (geom);
CREATE INDEX IF NOT EXISTS alerts_verified_idx ON alert_subscriptions (verified) WHERE verified;

-- Log of every alert we send, so a re-run of the sender doesn't double up.
CREATE TABLE IF NOT EXISTS alert_log (
  id             BIGSERIAL PRIMARY KEY,
  subscription_id BIGINT NOT NULL REFERENCES alert_subscriptions(id) ON DELETE CASCADE,
  project_id     BIGINT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  sent_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (subscription_id, project_id)
);
