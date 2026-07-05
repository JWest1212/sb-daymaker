-- Living Postcard Phase 1 — occasion vocabulary: add 'rainy_day'.
-- Kept in its OWN migration: a new enum value cannot safely share a transaction
-- with statements that might use it, so this runs isolated (spec §2).
-- ▶ JIM RUNS THIS. Do not run DDL from code.
alter type occasion_tag add value if not exists 'rainy_day';
