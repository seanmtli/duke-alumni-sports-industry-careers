-- Logo for the employer-logo stats/home-page feature. Populated by
-- scripts/fetch_company_logos.py from Crustdata's company_enrich
-- (linkedin_logo_url); null until backfilled.
alter table sports_companies add column if not exists logo_url text;
