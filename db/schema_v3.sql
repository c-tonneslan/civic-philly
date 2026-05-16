-- Schema v3: developer/applicant aggregation, RCOs, full-text search.

SET search_path TO civic, public;

-- Developer aggregation column. Backfilled by scripts/backfill-developers.mjs
-- from the raw_attrs JSON of each datasource.
ALTER TABLE civic.projects ADD COLUMN IF NOT EXISTS developer TEXT;
CREATE INDEX IF NOT EXISTS projects_developer_idx ON civic.projects (developer);

-- Full-text search vector. Generated column over name + description +
-- address so the index is always in sync with the row.
ALTER TABLE civic.projects
  ADD COLUMN IF NOT EXISTS tsv tsvector GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(name, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(address, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(developer, '')), 'B')
  ) STORED;
CREATE INDEX IF NOT EXISTS projects_tsv_idx ON civic.projects USING GIN (tsv);

-- Registered Community Organizations: the legally-required input bodies
-- for any zoning project in Philly. Knowing which RCO covers a given
-- project is the biggest single thing an organizer needs.
CREATE TABLE IF NOT EXISTS civic.rcos (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  primary_email   TEXT,
  primary_phone   TEXT,
  primary_name    TEXT,
  website     TEXT,
  meeting_info TEXT,
  geom        geography(MultiPolygon, 4326) NOT NULL,
  external_id TEXT UNIQUE
);
CREATE INDEX IF NOT EXISTS rcos_geom_idx ON civic.rcos USING GIST (geom);

-- Denormalized RCO id on projects (filled by backfill-spatial.mjs).
ALTER TABLE civic.projects ADD COLUMN IF NOT EXISTS rco_id INTEGER REFERENCES civic.rcos(id);
CREATE INDEX IF NOT EXISTS projects_rco_idx ON civic.projects (rco_id);

-- Outbound webhooks / subscription log for project status changes.
-- We piggyback on alert_log for new-project alerts; this is dedicated to
-- "your followed project changed status" notifications.
CREATE TABLE IF NOT EXISTS civic.status_alert_log (
  id              BIGSERIAL PRIMARY KEY,
  follow_id       BIGINT NOT NULL REFERENCES civic.follows(id) ON DELETE CASCADE,
  status_history_id BIGINT NOT NULL REFERENCES civic.status_history(id) ON DELETE CASCADE,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (follow_id, status_history_id)
);
