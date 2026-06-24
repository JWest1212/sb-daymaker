-- DEV DEMO — delete before launch
-- ============================================================================
-- SB Daymaker — Phase 8 pipeline demo input.
-- A few DRAFT things with facts only (no blurb/tags/category) so the nightly
-- pipeline has something to enrich. Run once in the Supabase SQL Editor.
-- Clean up later:  delete from things where source = 'pipeline_demo';
-- ============================================================================

insert into things (type, status, title, neighborhood, nearby_zone, address,
                    price_band, indoor, is_21_plus, starts_at, source)
values
  -- A dated event (pipeline should derive Tier 1)
  ('event', 'draft', 'Pipeline Demo: Live Jazz at the Lobero', 'downtown', 'downtown',
   '33 E Canon Perdido St, Santa Barbara, CA', '$$', true, false,
   '2026-07-04 19:30:00-07', 'pipeline_demo'),
  -- An evergreen place (Tier 3)
  ('place', 'draft', 'Pipeline Demo: Shoreline Park Overlook', 'mesa', 'mesa',
   'Shoreline Dr, Santa Barbara, CA', 'free', false, false,
   null, 'pipeline_demo'),
  -- A 21+ tasting room place (Tier 3; negative rule should drop family_day/free_sb)
  ('place', 'draft', 'Pipeline Demo: Anacapa Street Tasting Room', 'funk_zone', 'funk',
   '40 Anacapa St, Santa Barbara, CA', '$$', true, true,
   null, 'pipeline_demo');
