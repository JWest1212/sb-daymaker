-- Card Imagery Phase 3 · motif tier (additive)
-- Source: docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md §6.1
-- Verified against live schema 2026-07-10: `photo_source` enum exists with
-- ('pexels','wikimedia','google','owned','placeholder') — no 'motif' value yet.
-- `things` has no `visual_kind`/`visual_key`/`visual_seed` columns — no name
-- collisions. FOUNDER-RUN DDL — pasted into the Supabase SQL Editor by Jim,
-- not run from code.

alter type photo_source add value if not exists 'motif';
alter table things add column if not exists visual_kind text;   -- 'motif' | 'bigtype' | null
alter table things add column if not exists visual_key  text;   -- motif id, e.g. 'wharf'
alter table things add column if not exists visual_seed integer;
