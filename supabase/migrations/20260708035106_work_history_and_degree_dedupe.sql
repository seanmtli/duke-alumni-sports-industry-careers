-- Applied to project zhgiuztnmsffydyasgit on 2026-07-08.
--
-- NOTE: this is the first migration checked into the repo. Migrations
-- 20260622000832 .. 20260707032931 were applied directly against the hosted
-- project and exist only in supabase_migrations.schema_migrations. Until they
-- are backfilled here, `supabase db reset` will NOT reproduce this schema.

-- Structured employment history, one row per role.
-- Crustdata returns this on every person/enrich call the pipeline already pays
-- for; enrich.py previously discarded it.
create table if not exists work_history (
  id                    uuid primary key default gen_random_uuid(),
  person_id             uuid not null references people(id) on delete cascade,
  company               text not null,
  company_domain        text,
  crustdata_company_id  bigint,
  title                 text,
  start_date            date,
  end_date              date,           -- null = ongoing
  is_current            boolean not null default false,
  is_primary            boolean not null default false,  -- feeds people.current_company
  location              text,
  created_at            timestamptz default now()
);

create index if not exists work_history_person_id_idx on work_history(person_id);
create index if not exists work_history_company_idx   on work_history(lower(company));

-- Idempotent re-runs of the backfill. NULLS NOT DISTINCT (PG15+; this is PG17)
-- is required: without it, rows with a null title or start_date compare as
-- distinct on every run and duplicate. Two spells at the same employer with
-- different start_dates remain separate rows, which is correct.
create unique index if not exists work_history_dedupe_idx
  on work_history(person_id, company, title, start_date) nulls not distinct;

-- Match the project-wide RLS posture: RLS on, zero policies. anon/authenticated
-- are denied; the scripts and the Next.js server use the service_role key, which
-- bypasses RLS. Every other table in this schema is configured this way.
alter table work_history enable row level security;

-- enrich.py only ever inserted degrees for people with ZERO existing degree rows,
-- so a second Duke degree could never land (Sam Marks: Trinity BS 2014 + Fuqua
-- MBA 2020, stored as the single conflated row "Trinity BS 2020"). This index
-- lets the backfill upsert degrees instead of skipping.
--
-- Pre-existing exact duplicates would break the index creation; dedupe first.
-- (Ran clean: 1833 rows before and after.)
delete from duke_degrees a using duke_degrees b
 where a.ctid < b.ctid
   and a.person_id = b.person_id
   and a.school is not distinct from b.school
   and a.degree is not distinct from b.degree
   and a.grad_year is not distinct from b.grad_year;

create unique index if not exists duke_degrees_dedupe_idx
  on duke_degrees(person_id, school, degree, grad_year) nulls not distinct;
