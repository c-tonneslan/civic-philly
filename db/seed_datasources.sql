-- Seed rows for each upstream feed. quality_notes is what the UI shows
-- in the data quality panel; keep it honest.

INSERT INTO civic.datasources (id, name, agency, homepage_url, feed_url, license, description, quality_notes)
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
   'Zoning Permits (last 2 years)',
   'Philadelphia L&I',
   'https://opendataphilly.org/datasets/licenses-and-inspections-building-and-zoning-permits/',
   'https://phl.carto.com/api/v2/sql',
   'Public Domain',
   'Every issued zoning permit in the last two years. One row per permit number.',
   'Pulled from the city''s Carto SQL API. Capped at 5000 most-recent permits per refresh. Geocoding is by the city L&I system and is decent but not perfect; ~1% of permits fall outside Philadelphia bounds and get dropped. Status field is normalized from L&I''s free-text values with a best-effort mapping. The Zoning Board of Adjustment decisions dataset (which would have been a better fit) appears to have been retired from OpenDataPhilly.'
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
   'Major Capital Infrastructure Projects',
   'City of Philadelphia + partners',
   'https://www.phila.gov/programs/rebuild/',
   'manual-cip-curation',
   'Public Domain',
   'Major Philadelphia capital infrastructure projects (highway caps, school replacements, FDR Park, Rebuild, the Roosevelt Boulevard project, etc.). Hand-curated from the published CIP and agency press releases.',
   'Hand-curated, not a live feed. The Office of the Director of Finance does publish the six-year Capital Improvement Program PDF, but there''s no machine-readable feed; the dataset listed on OpenDataPhilly returns 404. Refreshed manually when the CIP is updated (annual budget cycle). Funding amounts are project lifetime totals, not annual spend. Locations are approximated for citywide programs.'
  )
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  agency = EXCLUDED.agency,
  homepage_url = EXCLUDED.homepage_url,
  feed_url = EXCLUDED.feed_url,
  description = EXCLUDED.description,
  quality_notes = EXCLUDED.quality_notes;
