-- ============================================================================
-- SB Daymaker — Canonical Data Schema  (happenings-first)
-- Status: v9 canon · last updated 2026-06-21 · supersedes all earlier pre-rename material
-- Postgres / Supabase.  Resolves Pre-Build Audit Gap B1.
-- Also lands the data layer for A6 (subscribers) and A7 (sponsor/featured fields).
-- This file is the single source of truth for the data contract.
-- ----------------------------------------------------------------------------
-- CARD IMAGERY / VENUES NOTE (2026-07-10): this file predates the Card Imagery
-- Phase 2 work. For venues, venue_photos, image_spend, image_cache,
-- photo_options, and things.venue_id, the current source of truth is the
-- migration files, not this dump: supabase/migrations/20260625_photo_options.sql,
-- supabase/migrations/20260625_images.sql, and
-- supabase/migrations/20260709_card_imagery_phase2_venues.sql.
-- ----------------------------------------------------------------------------
-- v9 CHANGELOG (the three-section cut — Explore · Saved · Discover SB):
--   • shared_state_kind: 'plan' -> 'shared_list'.  The My Plan itinerary builder
--     was retired; the surviving social artifact is a view-only SAVED-LIST share
--     link (Option A): payload = a list of thing ids; the opener can save their
--     own copy.  save_restore is still emailed to the user's OWN address;
--     shared_list links carry no recipient PII.
--   • guides gain `kind` (guide_kind: 'neighborhood' | 'theme') + `zone`
--     (nearby_zone) so Discover SB can surface live happenings scoped to a guide:
--     neighborhood guides join things on nearby_zone; theme guides match on `tag`.
--   • nearby_zone gains 'goleta' (now a Near Me anchor).  Near Me is an in-view
--     SORT on Explore + Saved — there is no Map screen and no Mapbox in V1.
-- ----------------------------------------------------------------------------
-- v2 CHANGELOG (Locked UX Decisions + 7 follow-on decisions):
--   • Happenings-first cascade (Dec 11): things.happening_tier (1/2/3, stored
--     base tier) + things.happening_category (16-value enum) + things.reason_to_go.
--   • recurring_schedules table (Dec 11/C): Tier-2 recurring rhythms, mirrors
--     happy_hour_windows.  Happy hours stay in their own table and union in.
--   • Occasion tags (Dec 10): persona enum -> occasion_tag (10 values);
--     thing_personas -> thing_tags; guides.persona -> guides.tag.
--   • shared_states table (Dec 8/9): one token->payload store, kind in
--     {save_restore, shared_list}.  Powers magic-link save-restore + the
--     shareable saved-list link (see v9 changelog above).
--   • Tier is DERIVED FROM STRUCTURE, not AI-judged: has-date -> T1,
--     has-recurring-schedule -> T2, else T3.  AI proposes the category only.
--   • Two-state saves ("want to go" / "been") + the Near Me sort stay
--     client-side; no schema change (saves are not in this DB — see end note).
-- ============================================================================

-- ---- Extensions ----------------------------------------------------------
create extension if not exists "pgcrypto";   -- gen_random_uuid()
create extension if not exists "citext";     -- case-insensitive email
create extension if not exists "pg_trgm";    -- fuzzy dedupe on title/venue

-- ============================================================================
-- ENUMS — constrained vocabularies, so no more free-text drift
-- ============================================================================
create type thing_type    as enum ('place','event','firstlook','happyhour');
create type thing_status  as enum ('draft','needs_review','published','archived');
create type price_band    as enum ('free','$','$$','$$$');
create type occasion_tag  as enum (
  'date_night','family_day','nightlife','catch_a_show','arts_culture',
  'outdoors_active','wine_food','free_sb','hosting_visitors','solo'
);
create type tod           as enum ('morning','afternoon','evening','late');
create type photo_source  as enum ('pexels','wikimedia','google','owned','placeholder');
create type tag_source    as enum ('ai','founder','rule');

-- Happenings-first taxonomy (Dec 1).  Closed 16-value set: 6 Tier-1 (discrete,
-- dated) / 5 Tier-2 (recurring rhythms) / 5 Tier-3 (evergreen, activity-framed).
-- The AI proposes the category; the TIER is derived from structure, not this.
create type happening_category as enum (
  -- Tier 1 — discrete, dated
  'live_music','festival_fair','arts_theater','community_gathering',
  'food_drink_event','sports_outdoors_event',
  -- Tier 2 — recurring rhythms
  'weekly_special','recurring_nightlife','recurring_market',
  'recurring_arts','recurring_outdoors',
  -- Tier 3 — evergreen, activity-framed (NEVER a bare place; always a reason to go)
  'outdoor_activity','food_drink_spot','culture_spot','shopping_browse','scenic_chill'
);

-- shared_states.kind (Dec 5): magic-link save-restore vs shareable saved-list link.
create type shared_state_kind as enum ('save_restore','shared_list');

-- Granular area the thing actually sits in:
create type neighborhood  as enum (
  'funk_zone','downtown','waterfront','montecito','mesa',
  'mission_canyon','riviera','upper_state','goleta','carpinteria','other'
);
-- Coarse zone used by the Near Me sort (the anchors the UI exposes) and by
-- neighborhood guides (Discover SB).  Storing this on the row kills the old
-- client-side AREA_TO_HOOD hard-coding:
create type nearby_zone   as enum ('funk','downtown','waterfront','montecito','mesa','goleta');

-- Discover SB guide kind (v9): neighborhood guides scope to a `zone`; theme
-- guides match on `tag`.  Each open guide surfaces the live happenings it scopes.
create type guide_kind     as enum ('neighborhood','theme');

create type edition_slot      as enum ('hero','secondary');
create type submission_kind   as enum ('event','business');
create type submission_status as enum ('new','parsed','approved','rejected','spam');
create type subscriber_status as enum ('pending','confirmed','unsubscribed');

-- ============================================================================
-- SPONSORS — Phase 2, reserved now so monetization is structurally possible.
-- TRUST RULE: sponsorship is a LABEL, never a ranking input.
-- The hero ranker must NEVER read is_featured / sponsor_id.  (Audit A7.)
-- ============================================================================
create table sponsors (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  contact_email citext,
  active        boolean not null default true,
  created_at    timestamptz not null default now()
);

-- ============================================================================
-- THINGS — the unified content unit: place | event | firstlook | happyhour
-- ============================================================================
create table things (
  id              uuid primary key default gen_random_uuid(),
  type            thing_type   not null,
  status          thing_status not null default 'draft',

  -- Identity / copy
  title           text not null,
  blurb           text,                 -- AI-drafted, founder-approved (short)
  blurb_long      text,                 -- detail-screen copy
  category        text,                 -- food | music | arts | outdoors | ...

  -- Happenings-first classification (Dec 1).  TIER is derived from structure
  -- (has-date -> 1, has-recurring-schedule -> 2, else 3) and STORED here so the
  -- cockpit and code can read it at a glance.  CATEGORY is AI-proposed.
  happening_tier     smallint not null default 3 check (happening_tier between 1 and 3),
  happening_category happening_category,   -- nullable in draft; required at publish (app code)
  reason_to_go       text,                 -- the activity framing; REQUIRED for Tier 3 (app code)

  -- Location
  neighborhood    neighborhood,         -- granular area
  nearby_zone     nearby_zone,          -- coarse zone for Near Me sort + neighborhood guides (replaces AREA_TO_HOOD)
  address         text,
  lat             double precision,
  lng             double precision,

  -- Classification / fit
  price_band      price_band,
  free            boolean generated always as (price_band = 'free') stored,
  indoor          boolean not null default false,   -- weather logic
  is_21_plus      boolean not null default false,   -- feeds the family negative-rule
  time_of_day_fit tod[] not null default '{}',

  -- Event-only timing
  starts_at       timestamptz,
  ends_at         timestamptz,
  buy_url         text,                 -- AXS/TM hand-off (never transacted here)

  -- Photos.  Google = place_id only (photo fetched live, never cached);
  -- every other source stores a real URL.
  place_id          text,               -- Google place_id (cacheable; the photo is NOT)
  photo_source      photo_source not null default 'placeholder',
  photo_url         text,               -- resolved URL for pexels / wikimedia / owned
  photo_query       text,               -- search term used (debug / re-resolve)
  photo_attribution text,

  -- Curation / ranking
  hero_eligible    boolean not null default true,
  editorial_weight smallint not null default 0,    -- manual ranking nudge (-5..+5)
  is_featured      boolean not null default false,  -- labeled placement (Phase 2)
  sponsor_id       uuid references sponsors(id),

  -- Freshness / provenance
  last_confirmed  timestamptz,
  source          text,                 -- 'ticketmaster' | 'venue:bowl' | 'submission' | 'seed' ...

  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),

  constraint events_have_start check (type <> 'event' or starts_at is not null)
);

create index things_status_idx        on things(status);
create index things_type_idx          on things(type);
create index things_nearby_zone_idx   on things(nearby_zone);
create index things_starts_at_idx     on things(starts_at);
create index things_last_confirmed_idx on things(last_confirmed);
create index things_hero_idx          on things(hero_eligible) where status = 'published';
create index things_title_trgm_idx    on things using gin (title gin_trgm_ops);  -- fuzzy dedupe

-- ============================================================================
-- THING_TAGS — occasion/intent tags (Dec 10; was thing_personas).
-- One row per (thing, tag): confidence + provenance.  Powers the occasion-tag
-- filter, the confidence threshold, and the negative-rule layer.
-- Tags set WHAT is shown; the happenings cascade sets ORDER — they're
-- orthogonal (no tag is wired to a tier).
-- ============================================================================
create table thing_tags (
  thing_id    uuid not null references things(id) on delete cascade,
  tag         occasion_tag not null,
  confidence  numeric(3,2) not null default 1.0,   -- 0.00–1.00
  tag_source  tag_source not null default 'ai',
  created_at  timestamptz not null default now(),
  primary key (thing_id, tag)
);
create index thing_tags_tag_idx on thing_tags(tag);
-- NEGATIVE RULE (enforced in app code at write time — see audit B4):
-- a thing with is_21_plus = true must NEVER receive tag = 'family_day'.
-- a thing with price_band <> 'free' must NEVER receive tag = 'free_sb'.
-- tag_source = 'rule' rows record founder / rule overrides.

-- ============================================================================
-- HAPPY_HOUR_WINDOWS — real schedules (fixes the prototype's fake "ends:47").
-- A happyhour thing has one window per day-of-week; "live now" + the countdown
-- are computed from these against the current local time.
-- ============================================================================
create table happy_hour_windows (
  id           uuid primary key default gen_random_uuid(),
  thing_id     uuid not null references things(id) on delete cascade,
  day_of_week  smallint not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  starts_local time not null,
  ends_local   time not null,
  deal_text    text,
  unique (thing_id, day_of_week)
);
create index hh_windows_thing_idx on happy_hour_windows(thing_id);

-- ============================================================================
-- RECURRING_SCHEDULES — Tier-2 recurring rhythms (Dec 1/C).  Mirrors
-- happy_hour_windows.  A thing carrying >=1 schedule row surfaces as TIER 2 on
-- its scheduled days (the overlay over its stored base tier).  Happy hours keep
-- their OWN table (own live-countdown + freshness behavior); the cascade
-- ranker unions both.
-- ============================================================================
create table recurring_schedules (
  id             uuid primary key default gen_random_uuid(),
  thing_id       uuid not null references things(id) on delete cascade,
  category       happening_category not null,   -- a Tier-2 value (app-validated)
  day_of_week    smallint not null check (day_of_week between 0 and 6),  -- 0 = Sunday
  start_time     time,
  end_time       time,                          -- nullable: all-day rhythms
  label          text,                          -- "Wine Down Wednesday", "First Thursday"
  last_confirmed date,                           -- freshness, same posture as happy hours
  unique (thing_id, day_of_week, category)
);
create index recurring_sched_thing_idx on recurring_schedules(thing_id);
create index recurring_sched_dow_idx   on recurring_schedules(day_of_week);

-- ============================================================================
-- GUIDES + GUIDE_STOPS — Discover SB.  Two kinds (v9): neighborhood guides scope
-- to a `zone` (live happenings join things on nearby_zone); theme guides match on
-- `tag`.  Stops are a table, not loose jsonb.  A stop that is a real place links
-- to it, so it can deep-link to the detail screen and be saved.
-- ============================================================================
create table guides (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  kicker      text,
  intro       text,
  kind        guide_kind not null default 'theme',  -- 'neighborhood' | 'theme' (Discover SB groups)
  zone        nearby_zone,         -- set for kind='neighborhood'; scopes live happenings by area
  tag         occasion_tag,        -- theme match / "✦ For you" (set for kind='theme')
  cover_url   text,
  status      thing_status not null default 'draft',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- a neighborhood guide must carry the zone it scopes; a theme guide must not
  constraint guide_scope_ck check (
    (kind = 'neighborhood' and zone is not null) or
    (kind = 'theme'        and zone is null)
  )
);
create index guides_kind_idx on guides(kind);
create index guides_zone_idx on guides(zone) where zone is not null;

create table guide_stops (
  id          uuid primary key default gen_random_uuid(),
  guide_id    uuid not null references guides(id) on delete cascade,
  position    smallint not null,
  thing_id    uuid references things(id),  -- nullable: free-text stops allowed
  label       text not null,
  note        text,
  unique (guide_id, position)
);
create index guide_stops_guide_idx on guide_stops(guide_id);

-- ============================================================================
-- EDITIONS + EDITION_PICKS — one approved day; ordered hero + secondary picks.
-- ============================================================================
create table editions (
  id           uuid primary key default gen_random_uuid(),
  edition_date date not null unique,
  status       thing_status not null default 'draft',   -- draft | published (= live)
  approved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table edition_picks (
  edition_id  uuid not null references editions(id) on delete cascade,
  thing_id    uuid not null references things(id),
  slot        edition_slot not null,         -- hero | secondary
  position    smallint not null default 0,   -- order within slot
  primary key (edition_id, thing_id)
);
-- Exactly one hero per edition:
create unique index edition_one_hero on edition_picks(edition_id) where slot = 'hero';

-- ============================================================================
-- SUBMISSIONS — raw inbound from the public forms.  Lands HERE, not in things.
-- Holds untrusted payload + submitter PII + consent, before AI parse/approval.
-- (Resolves the missing submissions table; pairs with form hardening, audit B10.)
-- ============================================================================
create table submissions (
  id              uuid primary key default gen_random_uuid(),
  kind            submission_kind not null,
  status          submission_status not null default 'new',
  raw_payload     jsonb not null,        -- as-submitted (incl. a pasted IG caption)
  submitter_name  text,
  submitter_email citext,
  consent         boolean not null default false,
  parsed_thing_id uuid references things(id),  -- set when approved → draft thing
  created_at      timestamptz not null default now()
);
create index submissions_status_idx on submissions(status);

-- ============================================================================
-- SUBSCRIBERS — weekend-digest opt-in.  The ONLY end-user PII in the system.
-- Double opt-in + one-click unsubscribe.  (Resolves the data layer of A6;
-- corrects "no users table" → "no end-user *account* table".)
-- ============================================================================
create table subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             citext not null unique,
  status            subscriber_status not null default 'pending',
  confirm_token     uuid not null default gen_random_uuid(),
  unsubscribe_token uuid not null default gen_random_uuid(),
  consented_at      timestamptz,
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now()
);

-- ============================================================================
-- SHARED_STATES — one token->payload store (Dec 5) for BOTH magic-link
-- save-restore AND the shareable saved-list link (v9).  Anonymous: keyed by an
-- opaque token, never an account.  No password, no login wall.
--   • kind='save_restore': payload = the user's saved-item list; `email` holds
--     the user's OWN delivery address (sits in the existing subscriber PII
--     boundary).  Overwritten on each backup; token stays stable.
--   • kind='shared_list': payload = a shared list of thing ids (one item or a
--     multi-select batch from Saved); `email` is NULL.  The opener views it and
--     can save their own copy.  Shared via the native share sheet — NO recipient
--     PII stored.  (This replaces the retired My Plan plan-link.)
-- Sliding expiry via last_accessed_at; one reaper job sweeps idle records.
-- ============================================================================
create table shared_states (
  token            text primary key,             -- opaque, unguessable; the URL key
  kind             shared_state_kind not null,
  payload          jsonb not null,
  email            citext,                        -- save_restore delivery only; NULL for shared_list
  created_at       timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);
create index shared_states_kind_idx        on shared_states(kind);
create index shared_states_last_access_idx on shared_states(last_accessed_at);

-- ============================================================================
-- AUDIT_LOG — every AI draft / approval / rule action.  The accountability trail.
-- ============================================================================
create table audit_log (
  id            uuid primary key default gen_random_uuid(),
  entity_type   text not null,        -- 'thing' | 'edition' | 'guide' | 'submission'
  entity_id     uuid,
  action        text not null,        -- 'ai_draft' | 'approve' | 'rule_override' | ...
  actor         text not null,        -- 'ai' | 'founder' | 'system'
  ai_confidence numeric(3,2),
  payload       jsonb,
  created_at    timestamptz not null default now()
);
create index audit_entity_idx on audit_log(entity_type, entity_id);

-- ============================================================================
-- updated_at trigger
-- ============================================================================
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_things_updated before update on things
  for each row execute function set_updated_at();
create trigger trg_guides_updated before update on guides
  for each row execute function set_updated_at();

-- ============================================================================
-- ROW-LEVEL SECURITY — public reads published rows only; writes = service role.
-- ============================================================================
alter table things            enable row level security;
alter table guides            enable row level security;
alter table editions          enable row level security;
alter table thing_tags        enable row level security;
alter table happy_hour_windows enable row level security;
alter table recurring_schedules enable row level security;
alter table guide_stops       enable row level security;
alter table edition_picks     enable row level security;

create policy public_read_things on things
  for select using (status = 'published');
create policy public_read_guides on guides
  for select using (status = 'published');
create policy public_read_editions on editions
  for select using (status = 'published');
create policy public_read_tags on thing_tags
  for select using (exists (select 1 from things t where t.id = thing_id and t.status = 'published'));
create policy public_read_hhw on happy_hour_windows
  for select using (exists (select 1 from things t where t.id = thing_id and t.status = 'published'));
create policy public_read_recurring on recurring_schedules
  for select using (exists (select 1 from things t where t.id = thing_id and t.status = 'published'));
create policy public_read_guidestops on guide_stops
  for select using (exists (select 1 from guides g where g.id = guide_id and g.status = 'published'));
create policy public_read_editionpicks on edition_picks
  for select using (exists (select 1 from editions e where e.id = edition_id and e.status = 'published'));

-- submissions / subscribers / sponsors / audit_log / shared_states have NO
-- public policies, so only the service role (server-side, RLS-bypassing) can
-- read/write them.  shared_states is read by token server-side, then returned
-- to the client — the opaque token is the capability, not a logged-in session.
-- Public INSERT into submissions/subscribers happens via a server action or a
-- tightly-scoped insert-only policy — add that when wiring the forms (audit B10).

-- ============================================================================
-- NOTE — saved items live in the user's device storage (no accounts), now with
-- TWO states client-side: "want to go" (default) and "been" (Dec 7).  The DB
-- never holds the live save list.  The iOS-eviction caveat (audit B8) is hedged
-- by the OPTIONAL magic-link backup: a one-off snapshot can be written to
-- shared_states (kind='save_restore') and restored on any device — sync without
-- an account.  That snapshot is the only time saves touch the server, by choice.
-- ============================================================================
