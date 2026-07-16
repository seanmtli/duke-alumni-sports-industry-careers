-- Duke sports-club alumni affiliations.
-- Club pages query people via person_clubs; the main directory stays
-- status=verified only. Non-sports club members use status=club_alumni.

-- Extend people.status check to allow club_alumni (non-directory members).
do $$
begin
  if exists (
    select 1 from pg_constraint
    where conname = 'people_status_check'
  ) then
    alter table people drop constraint people_status_check;
  end if;
  alter table people add constraint people_status_check
    check (status = any (array[
      'candidate'::text,
      'review'::text,
      'verified'::text,
      'rejected'::text,
      'archived'::text,
      'club_alumni'::text
    ]));
end $$;

create table if not exists duke_clubs (
  id              uuid primary key default gen_random_uuid(),
  slug            text not null unique,
  name            text not null,
  short_name      text not null,
  school_scope    text,
  description     text,
  match_patterns  jsonb not null default '{}'::jsonb,
  sort_order      int not null default 0,
  created_at      timestamptz not null default now()
);

create table if not exists person_clubs (
  id           uuid primary key default gen_random_uuid(),
  person_id    uuid not null references people(id) on delete cascade,
  club_id      uuid not null references duke_clubs(id) on delete cascade,
  source       text not null,
  evidence     text,
  role_title   text,
  confidence   numeric,
  created_at   timestamptz not null default now(),
  unique (person_id, club_id)
);

create index if not exists person_clubs_club_id_idx on person_clubs(club_id);
create index if not exists person_clubs_person_id_idx on person_clubs(person_id);

-- Match project-wide RLS posture: RLS on, zero policies. Scripts + Next.js
-- server use the service_role key (bypasses RLS).
alter table duke_clubs enable row level security;
alter table person_clubs enable row level security;

insert into duke_clubs (slug, name, short_name, school_scope, description, sort_order, match_patterns)
values
  (
    'dsbc',
    'Duke Sports Business Conference',
    'DSBC',
    'undergraduate',
    'Alumni who organized or participated in the Duke Sports Business Conference.',
    1,
    '{
      "activities": ["Duke Sports Business Conference", "DSBC"],
      "employers": ["Duke Sports Business Conference"]
    }'::jsonb
  ),
  (
    'dsac',
    'Duke Sports Analytics Club',
    'DSAC',
    'undergraduate',
    'Alumni of the Duke Sports Analytics Club.',
    2,
    '{
      "activities": ["Duke Sports Analytics", "Sports Analytics Club", "DSAC"],
      "employers": ["Duke Sports Analytics Club", "Duke Sports Analytics"]
    }'::jsonb
  ),
  (
    'fuqua-mes',
    'Fuqua Media, Entertainment, and Sports Club',
    'MES',
    'fuqua',
    'Alumni of Fuqua''s Media, Entertainment, and Sports (MES) Club.',
    3,
    '{
      "activities": [
        "Media, Entertainment, and Sports",
        "Media Entertainment & Sports",
        "Media, Entertainment & Sports",
        "MES Club"
      ],
      "employers": [
        "Fuqua Media, Entertainment, and Sports",
        "Media, Entertainment, and Sports Club"
      ],
      "require_fuqua": true
    }'::jsonb
  )
on conflict (slug) do update set
  name = excluded.name,
  short_name = excluded.short_name,
  school_scope = excluded.school_scope,
  description = excluded.description,
  sort_order = excluded.sort_order,
  match_patterns = excluded.match_patterns;
