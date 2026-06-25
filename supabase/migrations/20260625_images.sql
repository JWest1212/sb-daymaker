-- ============================================================================
-- SB Daymaker — Image pipeline support (Phase 13)
-- Additive + idempotent. Safe to re-run.
--
-- image_spend  : the app's own persisted monthly Google Place Photo counter
--                (enforces the ~$10/mo cap; resets implicitly per calendar month).
-- image_cache  : per-place resolution cache so a place is NEVER paid for twice
--                (Doc 11 §7b; audit flag B6). Free-source URLs + the Google
--                photoUri are stored here keyed by place; re-runs reuse them.
--
-- HOW TO RUN (one time): Supabase dashboard -> SQL Editor -> New query ->
--   paste this file -> Run. "Success. No rows returned."
-- ============================================================================

create table if not exists image_spend (
  month        text        primary key,           -- 'YYYY-MM' (UTC)
  google_calls int         not null default 0,     -- billable Google calls this month
  over_cap     int         not null default 0,     -- cards forced to placeholder by the cap
  updated_at   timestamptz not null default now()
);

create table if not exists image_cache (
  place_key     text        primary key,           -- place_id, else normalized title|hood
  photo_url     text,
  photo_source  text,
  photo_options jsonb       not null default '[]'::jsonb,
  attribution   text,
  resolved_at   timestamptz not null default now()
);
