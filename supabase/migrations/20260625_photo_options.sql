-- ============================================================================
-- SB Daymaker — Cockpit image-picker support (Phase 12)
-- Additive + idempotent. Safe to re-run.
--
-- photo_options holds the ranked, pre-fetched image alternates the cockpit
-- Edit-mode picker arrows through (Doc 11 §7c/§9a). Phase 13's image resolver
-- fills it; until then it stays '[]' and the picker shows the placeholder.
--
-- HOW TO RUN (one time): Supabase dashboard -> your project -> SQL Editor ->
--   New query -> paste this file -> Run. "Success. No rows returned."
-- ============================================================================

alter table things
  add column if not exists photo_options jsonb not null default '[]'::jsonb;
