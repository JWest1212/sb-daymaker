-- Card Imagery Phase 2 · venues + photo pools (additive)
-- Source: docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md §5.1
-- Verified against live schema 2026-07-09: no existing `venues`/`venue_photos`
-- tables, no existing `things.venue_id` column — no name collisions. gen_random_uuid()
-- (pgcrypto) and set_updated_at() both already live (sbdaymaker_schema.sql).
-- FOUNDER-RUN DDL — pasted into the Supabase SQL Editor by Jim, not run from code.

create table if not exists venues (
  id            uuid primary key default gen_random_uuid(),
  key           text unique not null,            -- slug, e.g. 'soho-music-club'
  display_name  text not null,
  place_id      text,                            -- Google place_id (cacheable identifier)
  lat           double precision,
  lng           double precision,
  radius_m      integer not null default 150,
  name_patterns text[] not null default '{}',    -- lowercase match tokens
  status        text not null default 'active',  -- 'active' | 'archived'
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table if not exists venue_photos (
  id            uuid primary key default gen_random_uuid(),
  venue_id      uuid not null references venues(id) on delete cascade,
  source        text not null,                   -- 'google' | 'wikimedia' | 'owned'
  stable_ref    text not null,                   -- google photo resource name, commons file title, or owned URL
  serving_url   text,                            -- current hotlinkable URL (google rows refreshed nightly)
  attribution   text,
  approved      boolean not null default false,  -- only approved rows ever render
  sort_order    integer not null default 0,
  refreshed_at  timestamptz,
  created_at    timestamptz not null default now(),
  unique (venue_id, stable_ref)
);

alter table things add column if not exists venue_id uuid references venues(id);

create index if not exists venue_photos_venue_idx on venue_photos (venue_id) where approved;
create index if not exists things_venue_idx on things (venue_id);

-- updated_at upkeep — not in the spec's literal §5.1 text, added to match the
-- existing things/guides convention (sbdaymaker_schema.sql's trg_*_updated
-- triggers): without this, venues.updated_at would sit frozen at insert time
-- through every future cockpit rename/radius/archive edit (§5.3 venue editor).
-- set_updated_at() already exists live; venue_photos has no updated_at column
-- (per spec) so it gets no trigger.
create trigger trg_venues_updated before update on venues
  for each row execute function set_updated_at();

-- RLS: public read of venues + approved photos only (mirrors public_read_things)
alter table venues enable row level security;
alter table venue_photos enable row level security;
create policy public_read_venues on venues for select using (status = 'active');
create policy public_read_venue_photos on venue_photos for select using (approved);

-- Service-role writes only (pipeline + cockpit), consistent with existing tables.
