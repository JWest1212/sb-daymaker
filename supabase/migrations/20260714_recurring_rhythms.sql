-- Data Arch Redesign — Recurring Registry spec. Moves the founder-maintained
-- recurring-rhythm registry (Doc 10 §8 #7, Doc 11 §11 Phase 14) from a
-- hardcoded TypeScript file (ingest/adapters/recurringRegistry.ts) into this
-- table, edited via /admin/coverage/recurring-rhythms. The nightly pipeline
-- reads this table only; the file is now a thin DB-to-adapter translator.
-- ▶ JIM RUNS THIS. Do not run DDL from code.
-- (Already applied by hand 2026-07-14 and seeded from the file's 4 entries;
-- checked in here for the record per CLAUDE.md §10's migrations-tree gap.)
create table if not exists recurring_rhythms (
  id             uuid primary key default gen_random_uuid(),
  slug           text not null,                       -- stable identity + dedupe key
  title          text not null,
  venue          text not null,
  address        text not null,
  neighborhood   neighborhood not null,                -- reuse existing 11-value enum
  category       happening_category not null,          -- reuse existing enum (a Tier-2 value)
  reason_to_go   text not null,
  frequency      text not null check (frequency in ('weekly','biweekly','monthly')),
  source_url     text not null,
  days           jsonb not null,                       -- [{dow:0-6, start:'HH:MM'|null, end:'HH:MM'|null}, ...]
  occasion_tags  occasion_tag[],                        -- null = use seedOccasionTags(category) default; non-null = explicit override
  active         boolean not null default true,         -- cockpit toggle
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create unique index if not exists recurring_rhythms_slug_idx on recurring_rhythms(slug);

alter table recurring_rhythms enable row level security;   -- service-role / cockpit only, no public policy
