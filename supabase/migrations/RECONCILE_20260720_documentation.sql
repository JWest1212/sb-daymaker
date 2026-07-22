-- Elevation v1 Cockpit build, Wave 1 item 10 (S9) — repo/DB reconciliation.
--
-- DOCUMENTATION OF ALREADY-APPLIED LIVE DDL. DO NOT RE-RUN BLINDLY.
--
-- docs/cockpit/06-data-architecture.md section 7.2 flags five objects the
-- code reads/writes that appear in NEITHER Core Project Files/sbdaymaker_schema.sql
-- NOR any checked-in supabase/migrations/*.sql file: they were applied straight
-- to the live Supabase DB (Elevation v1 Gates 1-5) and never checked in. This
-- file closes that gap by recording their exact live shape, queried directly
-- from the live DB's PostgREST OpenAPI schema on 2026-07-20 (information_schema
-- is not part of the checked-in schema.sql/migrations, so it was NOT inferred
-- from those files, per the "live DB is ahead of the repo" rule).
--
-- Every statement below is additive and guarded (create ... if not exists /
-- add column if not exists / a duplicate_object-safe DO block for the enum),
-- so it is a no-op against the live DB as it stands today. It exists so a
-- fresh environment (or a future contributor reading schema.sql cold) can
-- reconstruct the live shape, not as a change to be scheduled or executed
-- by an agent. Jim applies it by hand if it's ever needed, same as every
-- other file in this directory.

-- ---------------------------------------------------------------------------
-- 1. content_flags (whole table) — Elevation v1 Gate 1. Visitor corrections,
--    read/written by lib/flagsServer.ts and app/api/admin/flags/[id] (API-30).
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.flag_status as enum ('new', 'reviewing', 'resolved', 'dismissed');
exception when duplicate_object then null;
end $$;

create table if not exists content_flags (
  id           uuid primary key default gen_random_uuid(),
  thing_id     uuid references things(id),
  guide_id     uuid references guides(id),
  reason       text not null,
  detail       text,
  status       public.flag_status not null default 'new',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz
);

-- ---------------------------------------------------------------------------
-- 2. enrich_directives (whole table) — Elevation v1 Gate 1. Queued re-enrich
--    requests; app/api/admin/catalog/redraft selects/inserts, the ingest
--    worker's ingest/enrichDirectives.ts consumes.
-- ---------------------------------------------------------------------------
create table if not exists enrich_directives (
  id            uuid primary key default gen_random_uuid(),
  thing_id      uuid not null references things(id),
  status        text not null default 'queued',
  requested_by  text default 'founder',
  requested_at  timestamptz not null default now(),
  resolved_at   timestamptz
);

-- ---------------------------------------------------------------------------
-- 3. things.no_venue_ack (column) — Elevation v1 Gate. Only ever named in a
--    COMMENT in 20260711_images_desk.sql line 5 ("Mirrors the Venues
--    no-match catcher's things.no_venue_ack (V-4)"), never an ALTER TABLE.
--    Written by app/api/admin/venues/ack (API-44), read by lib/venuesServer.ts.
-- ---------------------------------------------------------------------------
alter table things add column if not exists no_venue_ack boolean not null default false;

-- ---------------------------------------------------------------------------
-- 4. things.slug (column) + 5. url_redirects (whole table) — Elevation v1
--    Gate 2 (findability/SEO). lib/slug/ensureSlug.ts's ensureSlugsForThings,
--    called from the API-56 approve path, writes things.slug and upserts
--    url_redirects on from_path when a slug changes.
-- ---------------------------------------------------------------------------
alter table things add column if not exists slug text;

create table if not exists url_redirects (
  from_path   text primary key,
  to_path     text not null,
  created_at  timestamptz not null default now()
);

-- Note: PostgREST's OpenAPI introspection (the source for this file) surfaces
-- primary/foreign keys but not plain unique indexes, so if things.slug also
-- carries a UNIQUE constraint live, it isn't reflected above. Jim, worth a
-- quick confirm in the Supabase table editor if this file is ever relied on.
