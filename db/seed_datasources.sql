-- Seed rows for each upstream feed. quality_notes is what the UI shows
-- in the data quality panel; keep it honest.

INSERT INTO datasources (id, name, agency, homepage_url, feed_url, license, description, quality_notes)
VALUES
  ('phl-housing',
   'Affordable Housing Production',
   'City of Philadelphia / DHCD',
   'https://opendataphilly.org/datasets/affordable-housing-production/',
   'https://services.arcgis.com/fLeGjb7u4uXqeF9q/arcgis/rest/services/AffordableHousingProduction/FeatureServer/0/query',
   'Public Domain',
   'Every affordable housing project funded through the city since 2011. ~490 records.',
   'Updated quarterly. fiscal_year_complete is sometimes just a year (2018) which we fold to Jan 1. No AMI breakdown. No council district on the source record (we backfill via spatial join). Older projects may be missing addresses.'
  ),
  ('phl-zoning',
   'Zoning Board of Adjustment Decisions',
   'Philadelphia ZBA',
   'https://opendataphilly.org/datasets/zoning-board-of-adjustment-zba-decisions/',
   'https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/ZBA_Decisions/FeatureServer/0/query',
   'Public Domain',
   'ZBA variance and special exception decisions. One row per case.',
   'Status uses ZBA decision codes (approved/denied/withdrawn). Address geocoding by the city is imperfect; ~5% of rows fall outside Philadelphia and are dropped. Updated weekly but with multi-week lag during busy hearing schedules.'
  ),
  ('septa-capital',
   'SEPTA Capital Budget Projects',
   'SEPTA',
   'https://www.septa.org/strategic-plan/reports/',
   'manual-capital-budget-2026',
   'Public Domain',
   'Major capital projects from the published SEPTA capital budget. Manually curated from the FY26 budget book.',
   'Manually curated, not a live feed. Refreshed each budget cycle (annual). Locations are approximate for line-wide projects (we plot the project at the line midpoint). Funding amounts are total project cost, not annual spend.'
  ),
  ('phl-infrastructure',
   'Capital Program Projects',
   'City of Philadelphia / Office of the Director of Finance',
   'https://opendataphilly.org/datasets/capital-program-projects/',
   'https://services.arcgis.com/fLeGjb7u4uXqeF9q/ArcGIS/rest/services/Capital_Program_Projects/FeatureServer/0/query',
   'Public Domain',
   'City-funded infrastructure projects from the six-year capital program.',
   'Geometry is sometimes a polygon (we centroid it). Some rows have funding flagged but no dollar amount (we leave it null rather than guessing). Status field is free-text in the source and we normalize it with a best-effort mapping.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  agency = EXCLUDED.agency,
  homepage_url = EXCLUDED.homepage_url,
  feed_url = EXCLUDED.feed_url,
  description = EXCLUDED.description,
  quality_notes = EXCLUDED.quality_notes;
