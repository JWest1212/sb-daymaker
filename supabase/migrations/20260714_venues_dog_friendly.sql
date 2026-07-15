-- Data Arch Redesign — Occasion Tags spec §3. Adds the founder-marked "does
-- this venue allow dogs" flag. A thing at a dog_friendly venue is stamped
-- `dog_friendly` live (lib/things.ts, same read-time-derivation pattern as
-- `indoor` -> `rainy_day`, Doc 22 §2.2) — no thing_tags row, no backfill.
-- Editable at /admin/venues (the "Dog Friendly checklist" section).
-- ▶ JIM RUNS THIS. Do not run DDL from code.
-- (Already applied by hand 2026-07-14; checked in here for the record per
-- CLAUDE.md §10's migrations-tree gap.)
alter table venues add column if not exists dog_friendly boolean not null default false;
