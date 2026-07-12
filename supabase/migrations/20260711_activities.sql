-- Home Rework spec §5 — Activity taxonomy tags on things (additive).
-- FOUNDER-RUN DDL — paste into the Supabase SQL Editor by hand; not run from code.
-- Renamed from the spec's literal "15_activities.sql" to match this folder's
-- existing YYYYMMDD_description.sql convention (every other migration here is
-- date-prefixed so Jim can paste them in chronological order).

alter table things
  add column if not exists activities text[] not null default '{}';

-- Optional index to support activity filtering at scale.
create index if not exists things_activities_gin
  on things using gin (activities);
