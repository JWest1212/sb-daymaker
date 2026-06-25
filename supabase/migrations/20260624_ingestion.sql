-- ============================================================================
-- SB Daymaker — Ingestion provenance + recurrence-cadence migration (Phase 9)
-- Doc 11 §2. Additive only; idempotent guards throughout. Safe to re-run.
-- Touches nothing in the existing `things` contract except adding the
-- `frequency` enum the seed pass proved `recurring_schedules` needs.
--
-- HOW TO RUN (one time, by hand):
--   Supabase dashboard -> your project -> SQL Editor -> New query ->
--   paste this whole file -> Run.  You should see "Success. No rows returned."
--   Re-running is safe (every step is guarded).
-- ============================================================================

-- 1) Recurring cadence: day_of_week alone cannot express "1st Thursday" /
--    "bi-monthly". Add a frequency enum + column (defaults to 'weekly').
do $$ begin
  create type recur_frequency as enum ('weekly','biweekly','monthly');
exception when duplicate_object then null; end $$;

alter table recurring_schedules
  add column if not exists frequency recur_frequency not null default 'weekly';

-- Backfill the two known sub-weekly art-walk rows from the seed.
-- Targeted by their stable uuid5 thing_id (no-ops cleanly if the seed
-- isn't loaded yet). 1st Thursday Art Walk -> monthly; Funk Zone -> biweekly.
update recurring_schedules
  set frequency = 'monthly'
  where thing_id = '29d8129b-a514-56aa-8028-5ddac4d620da'
    and category = 'recurring_arts';

update recurring_schedules
  set frequency = 'biweekly'
  where thing_id = '5fc68c7d-91ad-5014-893d-d7d2aab22116'
    and category = 'recurring_arts';

-- 2) Per-run bookkeeping for the nightly digest + the source-health panel.
create table if not exists source_runs (
  id            bigint generated always as identity primary key,
  source        text        not null,             -- adapter key, e.g. 'soho'
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  fetched       int         not null default 0,   -- raw items pulled
  qualified     int         not null default 0,   -- passed the gate
  dropped       int         not null default 0,   -- failed the gate
  landed        int         not null default 0,   -- newly inserted (post-dedupe)
  ok            boolean     not null default true, -- false => surfaced in digest
  error         text                              -- message if ok=false
);
create index if not exists source_runs_started_idx on source_runs (started_at desc);

-- 3) Every dropped candidate, with reason, so nothing vanishes silently.
create table if not exists ingest_drops (
  id           bigint generated always as identity primary key,
  run_id       bigint references source_runs(id) on delete cascade,
  source       text        not null,
  title        text,                              -- best-effort title for display
  reason       text        not null,             -- 'no_start' | 'no_title' | 'no_address' | 'no_source' | 'duplicate'
  detail       text,                              -- human note: 'said "8-ish"'
  source_url   text,
  raw          jsonb,                             -- the raw candidate, for manual rescue
  created_at   timestamptz not null default now()
);
create index if not exists ingest_drops_created_idx on ingest_drops (created_at desc);
