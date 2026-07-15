-- Occasion vocabulary: add 'dog_friendly'. Kept in its OWN migration, same
-- reasoning as 20260704_rainy_day_tag.sql: a new enum value cannot safely
-- share a transaction with statements that might use it.
-- ▶ JIM RUNS THIS. Do not run DDL from code.
-- (Confirmed ALREADY LIVE on the DB as of 2026-07-14, discovered via a live
-- query while building the Occasion Tags spec — someone ran this by hand at
-- an unknown earlier date and it was never checked in. Checked in now for the
-- record per CLAUDE.md §10's migrations-tree gap; this statement is a no-op
-- if run again (`if not exists`).)
alter type occasion_tag add value if not exists 'dog_friendly';
