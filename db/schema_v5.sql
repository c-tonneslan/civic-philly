-- Schema v5: real-estate transfers, owner networks.

SET search_path TO civic, public;

CREATE TABLE IF NOT EXISTS civic.transfers (
  id                BIGSERIAL PRIMARY KEY,
  external_id       TEXT NOT NULL UNIQUE,
  document_type     TEXT NOT NULL,
  transfer_date     DATE NOT NULL,
  address           TEXT,
  zip               TEXT,
  grantor           TEXT,
  grantee           TEXT,
  consideration     NUMERIC(14,2),
  fair_market_value NUMERIC(14,2),
  geom              geography(Point, 4326) NOT NULL
);
CREATE INDEX IF NOT EXISTS transfers_geom_idx ON civic.transfers USING GIST (geom);
CREATE INDEX IF NOT EXISTS transfers_date_idx ON civic.transfers (transfer_date DESC);
CREATE INDEX IF NOT EXISTS transfers_grantee_idx ON civic.transfers (grantee);
CREATE INDEX IF NOT EXISTS transfers_address_idx ON civic.transfers (address);
