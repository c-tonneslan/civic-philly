-- Schema v4: property ownership, L&I violations, saved searches.
-- The journalism unlock: link every project to its OPA parcel so we can
-- see "every property owned by this LLC" patterns.

SET search_path TO civic, public;

ALTER TABLE civic.projects ADD COLUMN IF NOT EXISTS opa_account TEXT;
CREATE INDEX IF NOT EXISTS projects_opa_idx ON civic.projects (opa_account);

CREATE TABLE IF NOT EXISTS civic.property_owners (
  parcel_number     TEXT PRIMARY KEY,
  owner_1           TEXT,
  owner_2           TEXT,
  mailing_address   TEXT,
  mailing_city_state TEXT,
  mailing_zip       TEXT,
  location_address  TEXT,
  market_value      INTEGER,
  imported_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS owners_owner1_idx ON civic.property_owners (owner_1);
CREATE INDEX IF NOT EXISTS owners_mailing_idx ON civic.property_owners (mailing_address);

-- L&I housing code violations: another displacement signal,
-- denser than demolition permits.
CREATE TABLE IF NOT EXISTS civic.violations (
  id              BIGSERIAL PRIMARY KEY,
  external_id     TEXT NOT NULL UNIQUE,
  case_number     TEXT,
  violation_date  DATE NOT NULL,
  address         TEXT,
  violation_type  TEXT,
  status          TEXT,
  geom            geography(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS violations_geom_idx ON civic.violations USING GIST (geom);
CREATE INDEX IF NOT EXISTS violations_date_idx ON civic.violations (violation_date DESC);
