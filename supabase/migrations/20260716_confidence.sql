-- Data Arch Redesign 24 — Phase 1: data_confidence + source_count (additive only)
-- Jim applied this by hand in Supabase SQL Editor on 2026-07-16. Checked in here
-- for the record, matching the sources-table migration's convention. Safe to re-run.

alter table things add column if not exists data_confidence numeric(3,2);
alter table things add column if not exists source_count smallint not null default 1;
