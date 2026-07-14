-- Doc 19 §3.1 — the Neighborhood Sweep's venue dictionary. Named
-- `venue_neighborhoods` (not `venues`) because a `venues` table already exists
-- for the unrelated Card Imagery venue-pool (image matching, lib/venuePool.ts).
-- ▶ JIM RUNS THIS. Do not run DDL from code.
-- (Already applied by hand 2026-07-13; checked in here for the record per
-- CLAUDE.md §10's migrations-tree gap.)
create table if not exists venue_neighborhoods (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  name_norm     text not null,                 -- lowercased, punctuation-stripped; match key
  neighborhood  neighborhood not null,         -- 11-value enum; door maps to 8 zones in code
  place_id      text,                          -- optional strong match to a Google Place
  aliases       text[] not null default '{}',  -- alternate names seen in titles/addresses
  created_by    text not null default 'founder',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create unique index if not exists venue_neighborhoods_name_norm_idx on venue_neighborhoods(name_norm);
create index  if not exists venue_neighborhoods_place_id_idx  on venue_neighborhoods(place_id) where place_id is not null;

alter table venue_neighborhoods enable row level security;
