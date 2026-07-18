-- Data Arch Redesign 26 — Dedup Upgrade + Canonical Event Identity
-- Jim applies this by hand in Supabase SQL Editor. Safe to re-run (all guards).
-- Checked in for the record per CLAUDE.md's migrations-tree convention — the
-- event_key column and event_sources table were already applied in Phases 1
-- and 4; only `things.merged_into` (Phase 5) is new as of this file.

-- Phase 1 — canonical event identity (already applied)
alter table things add column if not exists event_key text;
create index if not exists things_event_key_idx on things(event_key);

-- Phase 4 — corroboration: which sources confirmed a given event_key
-- (already applied). No FK on source_key -> sources(key): sourceKeyOf()'s
-- raw-hostname fallback for an unrecognized URL wouldn't necessarily match a
-- sources row, and this is provenance/audit data — better to degrade
-- gracefully than hard-fail a landing run on an FK violation.
create table if not exists event_sources (
  event_key   text not null,
  source_key  text not null,
  first_seen  timestamptz not null default now(),
  primary key (event_key, source_key)
);
create index if not exists event_sources_event_key_idx on event_sources(event_key);

-- Phase 5 — auditable, reversible merges (new). A near-dupe drop now lands
-- its full candidate too, as status='archived' pointing at its survivor here,
-- instead of being silently discarded — the cockpit's Merged panel can then
-- flip status back to needs_review and clear this to undo a wrong merge.
alter table things add column if not exists merged_into uuid references things(id);
create index if not exists things_merged_into_idx on things(merged_into) where merged_into is not null;
