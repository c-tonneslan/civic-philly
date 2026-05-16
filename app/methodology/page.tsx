import Link from "next/link";

export const metadata = { title: "Methodology — civic-philly" };

export default function MethodologyPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/" className="text-xs text-[var(--ink-dim)] hover:text-[var(--ink)] underline-offset-2 hover:underline">
          &larr; back to map
        </Link>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">Methodology</h1>
        <p className="mt-3 text-[var(--ink-dim)] leading-relaxed">
          Every field on this site, where it comes from, what we did to it, and what we don't know.
          Cite it.
        </p>

        <Section title="Projects">
          <p>
            A &quot;project&quot; here means any housing development, transit infrastructure,
            zoning permit, or city capital project that we found in one of the source feeds. One row
            in the <code>civic.projects</code> table represents one real-world project, deduplicated
            by (datasource, external_id). The same physical site can show up multiple times across
            different feeds (a housing site might appear in both Affordable Housing Production and
            in Zoning Permits) and they get separate rows because they're tracking different things.
          </p>
        </Section>

        <Section title="Data sources">
          <Source name="Affordable Housing Production"
                  agency="City of Philadelphia / DHCD"
                  link="https://opendataphilly.org/datasets/affordable-housing-production/"
                  records="~470" cadence="Quarterly">
            Every project funded through the city's affordable-housing program since 2011. We pull
            via the ArcGIS FeatureServer. <code>fiscal_year_complete</code> is sometimes just a year
            value (2018); we fold to January 1 of that year. We don't have AMI breakdown, unit
            mix, or council district on the source rows: district + tract are joined in spatially.
            Status is inferred from <code>development_type</code> + <code>fiscal_year_complete</code>.
          </Source>

          <Source name="Zoning Permits (last 2 years)"
                  agency="Philadelphia L&I"
                  link="https://opendataphilly.org/datasets/licenses-and-inspections-building-and-zoning-permits/"
                  records="~4,800" cadence="Continuous">
            Issued zoning permits from the city's Carto SQL API. We query the last 24 months,
            capped at the 5,000 most-recent rows per refresh. We drop permits whose geometry falls
            outside our Philadelphia bounding box (~1% of rows, usually misgeocoded). Status is a
            best-effort normalization of L&I's free-text values. The Zoning Board of Adjustment
            decisions dataset would have been a better fit for this category but it appears to have
            been retired from OpenDataPhilly without replacement.
          </Source>

          <Source name="SEPTA Capital Budget Projects"
                  agency="SEPTA"
                  link="https://www.septa.org/strategic-plan/reports/"
                  records="7" cadence="Manual / annual">
            Hand-curated from the published FY26 capital budget book. SEPTA does not publish a
            machine-readable capital project list. Locations for line-wide projects (Trolley Mod, BSL
            cars) are plotted at the line midpoint; this is a simplification. Funding amounts are
            total project life-cycle cost, not annual spend.
          </Source>

          <Source name="Major City Capital Infrastructure"
                  agency="City of Philadelphia + partners"
                  link="https://www.phila.gov/programs/rebuild/"
                  records="8" cadence="Manual / annual">
            Hand-curated from the published Capital Improvement Program and agency press releases.
            The OpenDataPhilly Capital Program Projects dataset returns 404, so there is no live feed.
            Refreshed manually when the CIP is updated. Citywide programs (Rebuild, Green City)
            are plotted at City Hall as a placeholder.
          </Source>
        </Section>

        <Section title="Context layers">
          <Source name="Census tracts + ACS 5-year"
                  agency="US Census Bureau"
                  link="https://www.census.gov/programs-surveys/acs/"
                  records="408" cadence="Annual (Dec)">
            Boundaries from TIGER for state 42, county 101. Values from the ACS 5-year 2018-2022
            release. Rent burden is computed as (households spending 30%+ of income on gross rent)
            divided by (total renter households). Renter share is renter-occupied / occupied
            households. Race percentages are <code>B03002</code> series divided by total population.
            Some tracts have null values where the source row had no margin of error or was suppressed.
          </Source>

          <Source name="Council districts"
                  agency="City of Philadelphia"
                  link="https://opendataphilly.org/datasets/?q=council"
                  records="10" cadence="Per redistricting">
            ArcGIS FeatureServer. These are the 2024 boundaries. A project's district is computed
            by spatial join (<code>ST_Intersects</code>) and stored on the project row so we don't
            have to re-join at read time. Reruns of the backfill update any project whose location
            changed.
          </Source>

          <Source name="Registered Community Organizations"
                  agency="City of Philadelphia / L&I"
                  link="https://opendataphilly.org/datasets/?q=rco"
                  records="239" cadence="Quarterly">
            RCO polygons typically overlap (a single parcel often falls in 2-4 RCOs). We pick the
            smallest-area RCO containing the point on the theory that the smaller boundary is the
            more local body. This is a simplification: in practice many projects have to notice
            multiple RCOs.
          </Source>

          <Source name="Elected officials"
                  agency="Hand-curated"
                  link="https://phlcouncil.com/"
                  records="18" cadence="Manual on election">
            City Council (10 district + 7 at-large) and the Mayor, with email, phone, office address,
            and link to the official site. Refreshed manually after every election. Doesn't include
            state or federal representatives.
          </Source>

          <Source name="Displacement signal: demolition permits"
                  agency="Philadelphia L&I"
                  link="https://opendataphilly.org/datasets/licenses-and-inspections-building-and-zoning-permits/"
                  records="~1,400" cadence="Continuous">
            L&I demolition permits from the last 3 years. We use this as a proxy for housing
            stock loss because Philadelphia does not publish eviction filings as open data. A
            demolition permit doesn't always equal displacement (vacant structures get demolished
            too), but the trend over time and the spatial clustering pattern still tell you something.
          </Source>
        </Section>

        <Section title="Derived fields">
          <p>
            <strong>developer</strong>: pulled from <code>developer_name</code> on housing rows and
            <code>contractorname</code> on zoning rows. The same firm may appear under slightly
            different spellings; we don't normalize beyond trimming whitespace.
          </p>
          <p>
            <strong>status_history</strong>: every time the scrape pipeline sees a project's status
            change vs the last snapshot, we record a new row. This is what powers
            the &quot;<Link href="/stalled" className="underline">stalled projects</Link>&quot; view
            and the timeline on each project page. Since the table just started populating, the
            initial backfill stamps every project with its current status; the meaningful history
            accumulates from there.
          </p>
          <p>
            <strong>search vector</strong>: a Postgres <code>tsvector</code> generated column over
            name (weight A), address + developer (weight B), and description (weight C). Queries hit
            the GIN index using <code>websearch_to_tsquery</code> so multi-word and quoted phrase
            searches both work.
          </p>
        </Section>

        <Section title="Known gaps">
          <ul className="list-disc pl-5 space-y-1">
            <li>Eviction filings are not publicly available as open data. We use demolition permits as a proxy.</li>
            <li>SEPTA capital projects are hand-curated, not a live feed.</li>
            <li>The city's Capital Program Projects dataset is gone; major infrastructure projects are also hand-curated.</li>
            <li>Zoning Board of Adjustment decisions used to be on OpenDataPhilly but the endpoint 404s. We use issued zoning permits instead.</li>
            <li>Some affordable-housing rows have only a fiscal year, not a real completion date.</li>
            <li>RCOs overlap; we pick the smallest area. In practice, organizers should always check the full RCO list for a site.</li>
            <li>State and federal elected officials aren't included.</li>
            <li>Funding amounts on city infrastructure are project lifetime totals, not annual spend.</li>
          </ul>
        </Section>

        <Section title="Use, license, citation">
          <p>
            All underlying data is in the public domain (City of Philadelphia, SEPTA, US Census).
            Code is MIT. If you cite this site in reporting, the line is:
          </p>
          <pre className="bg-[var(--panel)] border border-[var(--line)] rounded p-3 text-xs whitespace-pre-wrap">
{`civic-philly (civic-philly.vercel.app), accessed ${new Date().toISOString().slice(0, 10)}.
Aggregated from OpenDataPhilly, US Census ACS 5-year 2018-2022, and SEPTA.`}
          </pre>
        </Section>

        <Section title="Reproduce">
          <p>
            Code at <a href="https://github.com/c-tonneslan/civic-philly" className="underline">github.com/c-tonneslan/civic-philly</a>.
            The <code>scripts/</code> directory contains every loader. Anyone can run them against
            their own Postgres + PostGIS instance with a Census API key.
          </p>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-medium mb-3">{title}</h2>
      <div className="space-y-3 text-sm text-[var(--ink)]/90 leading-relaxed">{children}</div>
    </section>
  );
}

function Source({
  name, agency, link, records, cadence, children,
}: {
  name: string; agency: string; link: string; records: string; cadence: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-[var(--line)] rounded-lg p-4 bg-[var(--panel)]">
      <div className="flex justify-between items-start flex-wrap gap-2">
        <div>
          <a href={link} target="_blank" rel="noreferrer" className="font-medium underline-offset-2 hover:underline">
            {name}
          </a>
          <div className="text-xs text-[var(--ink-dim)] mt-0.5">{agency}</div>
        </div>
        <div className="text-[10px] text-[var(--ink-dim)] uppercase tracking-wider text-right">
          <div>{records}</div>
          <div>{cadence}</div>
        </div>
      </div>
      <div className="mt-3 text-[13px] leading-relaxed text-[var(--ink)]/85 space-y-2">{children}</div>
    </div>
  );
}
