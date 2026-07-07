-- Displacement Pressure Index (DPI): a per-census-tract 0–100 score combining
-- four present-pressure signals, each converted to a citywide percentile so the
-- score is a relative ranking, not an absolute claim.
--
-- Components (equal weight, renormalized when a component is missing):
--   • housing-code violation density   (civic.violations, ~1y — loader holds ~1y/5000)
--   • demolition permit rate           (civic.displacement_signals, 3y)
--   • speculative flip rate            (same address sold 2+ times in ~18mo,
--                                        SHERIFF'S DEED excluded as distress not speculation)
--   • rent-burdened share              (civic.census_tracts.pct_rent_burdened, ACS)
--
-- Honest limits (see /methodology): event windows are bounded by what the
-- loaders hold (violations effectively recent, transfers ~18mo), flips are
-- address-matched (no parcel id) and unflagged for arm's-length, and a single
-- ACS vintage means this measures PRESENT pressure, not a longitudinal trajectory.

CREATE MATERIALIZED VIEW IF NOT EXISTS civic.tract_displacement_index AS
WITH viol AS (
  SELECT t.geoid, COUNT(*) AS n
    FROM civic.census_tracts t
    JOIN civic.violations v ON ST_Intersects(t.geom, v.geom)
   WHERE v.violation_date >= NOW() - INTERVAL '1 year'
   GROUP BY t.geoid
),
demo AS (
  SELECT t.geoid, COUNT(*) AS n
    FROM civic.census_tracts t
    JOIN civic.displacement_signals d ON ST_Intersects(t.geom, d.geom)
   WHERE d.event_date >= NOW() - INTERVAL '3 years'
   GROUP BY t.geoid
),
-- Addresses sold 2+ times inside the transfer window = speculative churn.
-- One representative geom per address, so the tract join can't fan out.
flip_addr AS (
  SELECT address,
         (array_agg(geom ORDER BY transfer_date))[1] AS geom
    FROM civic.transfers
   WHERE address IS NOT NULL
     AND document_type IN ('DEED', 'MISCELLANEOUS DEED')  -- exclude SHERIFF'S DEED (distress)
     AND transfer_date >= NOW() - INTERVAL '18 months'
   GROUP BY address
  HAVING COUNT(*) >= 2
),
flip AS (
  SELECT t.geoid, COUNT(*) AS n
    FROM civic.census_tracts t
    JOIN flip_addr f ON ST_Intersects(t.geom, f.geom)
   GROUP BY t.geoid
),
base AS (
  SELECT t.geoid,
         t.total_pop,
         t.pct_rent_burdened,
         COALESCE(viol.n, 0) AS n_viol,
         COALESCE(demo.n, 0) AS n_demo,
         COALESCE(flip.n, 0) AS n_flip,
         ST_X(ST_Centroid(t.geom::geometry)) AS centroid_lng,
         ST_Y(ST_Centroid(t.geom::geometry)) AS centroid_lat
    FROM civic.census_tracts t
    LEFT JOIN viol ON viol.geoid = t.geoid
    LEFT JOIN demo ON demo.geoid = t.geoid
    LEFT JOIN flip ON flip.geoid = t.geoid
   WHERE t.total_pop >= 200   -- MAUP guard: tiny-population tracts spike on 1–2 events
),
rated AS (
  SELECT *,
         n_viol::numeric / NULLIF(total_pop, 0) * 1000 AS viol_rate,
         n_demo::numeric / NULLIF(total_pop, 0) * 1000 AS demo_rate,
         n_flip::numeric / NULLIF(total_pop, 0) * 1000 AS flip_rate
    FROM base
),
ranked AS (
  SELECT *,
         PERCENT_RANK() OVER (ORDER BY viol_rate) AS pr_viol,
         PERCENT_RANK() OVER (ORDER BY demo_rate) AS pr_demo,
         PERCENT_RANK() OVER (ORDER BY flip_rate) AS pr_flip,
         -- Rank rent-burden only among tracts that HAVE the value; NULL tracts
         -- get their own partition and are set to NULL below, so a missing value
         -- never sorts to maximum pressure.
         CASE WHEN pct_rent_burdened IS NULL THEN NULL
              ELSE PERCENT_RANK() OVER (PARTITION BY (pct_rent_burdened IS NULL) ORDER BY pct_rent_burdened)
         END AS pr_burden
    FROM rated
)
SELECT geoid,
       total_pop,
       pct_rent_burdened,
       n_viol, n_demo, n_flip,
       viol_rate, demo_rate, flip_rate,
       pr_viol, pr_demo, pr_flip, pr_burden,
       -- Mean of the available component percentiles × 100. Renormalizes over 3
       -- components when rent-burden is missing (rather than treating it as 0).
       ROUND(
         ((pr_viol + pr_demo + pr_flip + COALESCE(pr_burden, 0))
          / (3 + CASE WHEN pr_burden IS NULL THEN 0 ELSE 1 END) * 100)::numeric,
         1
       ) AS dpi,
       centroid_lng,
       centroid_lat
  FROM ranked
WITH DATA;

-- Unique index required so REFRESH MATERIALIZED VIEW CONCURRENTLY works.
CREATE UNIQUE INDEX IF NOT EXISTS tract_dpi_geoid ON civic.tract_displacement_index (geoid);
