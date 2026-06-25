-- ============================================================================
-- SB DAYMAKER — COMPILED SEED  (RUNNING FULL FILE · all batches to date)
-- ============================================================================
-- Window for events: 2026-06-23 .. 2026-07-24 (America/Los_Angeles, PDT -07:00)
-- This is the single, regenerated running seed. It supersedes sbdaymaker_seed_all.sql
-- and the b8–b10 append; load THIS file alone.
--
-- Contents: 107 things total = 54 events + 53 places, plus thing_tags and one
--           recurring_schedules row. All rows status='needs_review'.
--   Batches 1-7  (base) ....... 39 events + 15 places   (7 core neighborhoods)
--   Batch 8  SOhO long tail ... 8 events                (Downtown)
--   Batch 9  Carpinteria ...... 1 event + 1 Tier-2 market + 3 places  (Carpinteria)
--   Batch 10 Mesa/Upper State . 4 places                (Mesa, Upper State)
--   + Funk Zone tag backfill (15 rows tagged)
--   Batch 11 Outdoors/Scenic .. 12 places               (beaches, trails, wharf, gardens)
--   Batch 12 Recurring Rhythms . 1 place + 8 schedule rows  (trivia, happy hour, live music)
--   Batch 13 Sports/Active ...... 5 events + 1 schedule row   (polo, races, Nite Moves)
--   Batch 14 Goleta deep-dive .... 8 places + 1 schedule row   (beach, breweries, market, Stow House)
--   Batch 15 Recurring Arts ...... 2 events + 2 schedule rows  (1st Thursday, Funk Zone Art Walk)
--   Batch 16 Shopping/Culture .... 7 places                (bookstores, Public Market, Mission, SBMA, Courthouse)
--   Batch 17 Upper State close ... 1 place                 (Harry's Plaza Cafe)
--
-- IDEMPOTENT & ORDER-INDEPENDENT:
--   • Stable uuid5 primary keys (NS=6ba7b811-..-00c04fd430c8, key = source|title for
--     events; 'seed:google_places|title' for places). Re-running never double-loads.
--   • Every insert carries `on conflict do nothing`.
--   • The local_note column guard runs once below (was Doc-9 schema gap).
--
-- HOW TO LOAD:  psql "$DATABASE_URL" -f sbdaymaker_seed_all.sql
--   (or paste into the Supabase SQL editor). Safe to re-run.
--
-- AFTER LOADING: review the needs_review queue in-app/cockpit before publishing.
--   Carry-over flags are listed in the companion handoff .md + chat reports.
-- ============================================================================

alter table things add column if not exists local_note text;


-- ============================================================================
-- BATCH 1 — Mixed marquee (SB Bowl, Wine Festival, July 4th, library, farmers market, French Wave, Jackalope)
-- (source file: seed_events.sql)
-- ============================================================================
-- SB Daymaker seed — dated events 2026-06-23..2026-07-23 — status=needs_review — VERIFY before publishing
-- Every factual value sourced from a live page (see source column). Voice/classification grounded only in those facts.
-- lat/lng, place_id, and photos are intentionally left to a later geocode/photo-resolve step (not inferred here).


insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('98d33791-b5d3-5891-9a37-41bb506b5318', 'event', 'needs_review', 'Royel Otis: meet me in the car tour', 'The Australian indie-rock duo brings its dreamy, surf-tinged guitar hooks to the Bowl, with Ax and the Hatchetmen opening.', 'music', 1, 'live_music', 'riviera', NULL, 'Santa Barbara Bowl, 1122 N. Milpas Street, Santa Barbara, CA 93103', '$$', false, false, '{evening}', '2026-07-09T19:00:00-07:00'::timestamptz, NULL, 'https://www.axs.com/events/1442098/royel-otis-tickets', 'placeholder', 'Santa Barbara Bowl Santa Barbara', 'Gates open at 5:30 — give yourself about 90 minutes; Bowl parking is limited and uphill, with the Santa Barbara High lot ($20, cash) the main bet.', '2026-06-23'::timestamptz, 'https://sbbowl.com/concerts/royel-otis-2026-07-09/'),
  ('a5752143-7a84-516d-9b7c-200d55cd56df', 'event', 'needs_review', 'Gabriel ‘Fluffy’ Iglesias', 'Don’t worry, be fluffy — the Hawaiian-shirted storyteller brings his high-energy, family-friendly stand-up to the Bowl for a summer night under the oaks.', 'arts', 1, 'arts_theater', 'riviera', NULL, 'Santa Barbara Bowl, 1122 N. Milpas Street, Santa Barbara, CA 93103', '$$', false, false, '{evening}', '2026-07-17T19:00:00-07:00'::timestamptz, NULL, 'https://www.axs.com/events/1231173/gabriel-fluffy-iglesias-tickets?skin=sbbowl', 'placeholder', 'Santa Barbara Bowl Santa Barbara', 'Gates at 5:30; arrive early — Bowl parking is limited and uphill, and the Santa Barbara High lot is the go-to.', '2026-06-23'::timestamptz, 'https://sbbowl.com/concerts/gabriel-fluffy-iglesias-2026-07-17/'),
  ('7edaa467-e671-5fcc-bf2d-0bba6b9b148a', 'event', 'needs_review', 'Young The Giant: Victory Garden Tour', 'The SoCal alt-rock favorites headline with Cold War Kids and Kennyhoopla — a stacked bill for a summer evening at the Bowl.', 'music', 1, 'live_music', 'riviera', NULL, 'Santa Barbara Bowl, 1122 N. Milpas Street, Santa Barbara, CA 93103', '$$$', false, false, '{evening}', '2026-07-18T18:00:00-07:00'::timestamptz, NULL, 'https://www.axs.com/events/1317909/young-the-giant-tickets', 'placeholder', 'Santa Barbara Bowl Santa Barbara', 'Gates open at 5:00 for this one; plan ~90 minutes for parking and the climb up to your seat.', '2026-06-23'::timestamptz, 'https://sbbowl.com/concerts/young-the-giant-2026-07-18/'),
  ('751a860a-7d33-5f2f-84b8-95df002e0db3', 'event', 'needs_review', 'Rainbow Kitten Surprise: bones North American Tour', 'Rainbow Kitten Surprise rolls through with Spacey Jane — genre-bending indie to close out a July weekend at the Bowl.', 'music', 1, 'live_music', 'riviera', NULL, 'Santa Barbara Bowl, 1122 N. Milpas Street, Santa Barbara, CA 93103', '$$$', false, false, '{evening}', '2026-07-19T19:00:00-07:00'::timestamptz, NULL, 'https://www.axs.com/events/1192963/rainbow-kitten-surprise-tickets?skin=sbbowl', 'placeholder', 'Santa Barbara Bowl Santa Barbara', 'Gates at 5:30; the Santa Barbara High lot ($20, cash) two blocks down is the easiest park.', '2026-06-23'::timestamptz, 'https://sbbowl.com/concerts/rainbow-kitten-surprise-2026-07-19/'),
  ('909ee65f-c9bc-5745-af11-a628828d60d4', 'event', 'needs_review', 'California Wine Festival: Sunset Rare & Reserve Tasting', 'The festival’s most intimate evening: a sparkling-wine reception under the stars at the Hilton’s Plaza del Sol, with rare reserve pours matched to chef bites.', 'food', 1, 'food_drink_event', 'waterfront', 'waterfront', 'Hilton Santa Barbara Beachfront Resort, Plaza Del Sol, 633 E Cabrillo Blvd, Santa Barbara, CA 93103', NULL, false, true, '{evening}', '2026-07-17T18:30:00-07:00'::timestamptz, '2026-07-17T21:00:00-07:00'::timestamptz, 'https://www.eventbrite.com/e/2026-california-wine-festival-santa-barbara-july-17-18-tickets-1981355372255', 'placeholder', 'Hilton Santa Barbara Beachfront Resort Santa Barbara', 'A 21+ evening; your ticket covers unlimited wine and food samples plus a keepsake glass — buy ahead, a sellout is expected.', '2026-06-23'::timestamptz, 'https://www.californiawinefestival.com/faq'),
  ('293e8b2a-4922-5867-89a8-5fb72072649c', 'event', 'needs_review', 'California Wine Festival: Beachside Wine Festival', 'The signature beachside bash returns to Chase Palm Park — hundreds of California wines, craft brews, and a tri-tip throwdown, all to a live band by the sea.', 'food', 1, 'food_drink_event', 'waterfront', 'waterfront', 'Chase Palm Park Field – Oceanside, 236 E. Cabrillo Blvd., Santa Barbara, CA 93103', NULL, false, true, '{afternoon}', '2026-07-18T13:00:00-07:00'::timestamptz, '2026-07-18T16:00:00-07:00'::timestamptz, 'https://www.eventbrite.com/e/2026-california-wine-festival-santa-barbara-july-17-18-tickets-1981355372255', 'placeholder', 'Chase Palm Park Field – Oceanside Santa Barbara', '21+, beachside and outdoors; VIP and early entry start at noon, general at 1. Advance tickets run $10–$20 under the gate.', '2026-06-23'::timestamptz, 'https://www.californiawinefestival.com/faq'),
  ('9d9118db-8f64-52ad-8af9-dc09e0f21ffb', 'event', 'needs_review', 'Santa Barbara Fourth of July Celebration', 'The city’s biggest free party of the summer — a full day of live music on West Beach capped by a 20-minute fireworks show over the Pacific.', 'community', 1, 'community_gathering', 'waterfront', 'waterfront', 'West Beach, 99 W. Cabrillo Blvd., Santa Barbara, CA 93101', 'free', false, false, '{afternoon}', '2026-07-04T11:00:00-07:00'::timestamptz, '2026-07-04T21:30:00-07:00'::timestamptz, NULL, 'placeholder', 'West Beach Santa Barbara', 'Free and all-ages; you can stake out blankets and chairs from 6 a.m., and fireworks launch off West Beach around 9 p.m.', '2026-06-23'::timestamptz, 'https://santabarbaraca.gov/press-releases/santa-barbara-celebrates-americas-250-anniversary-fourth-july'),
  ('50747904-84fe-5b67-96dd-2ac007908639', 'event', 'needs_review', 'American Revolution Experience: A Traveling Exhibit', 'A free traveling exhibit at the Central Library marking America’s 250th, tracing Santa Barbara’s own threads to the Revolutionary War.', 'arts', 1, 'arts_theater', 'downtown', 'downtown', 'Santa Barbara Central Library, Fireplace Room, 40 E. Anapamu St., Santa Barbara, CA 93101', 'free', true, false, '{morning}', '2026-07-10T10:00:00-07:00'::timestamptz, '2026-07-17T17:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Santa Barbara Central Library Santa Barbara', 'Free, during regular library hours through July 17; DAR docents may greet you to share Santa Barbara’s Revolutionary-War ties.', '2026-06-23'::timestamptz, 'https://santabarbaraca.gov/press-releases/santa-barbara-celebrates-americas-250-anniversary-fourth-july'),
  ('e307dd70-2e6a-5bd0-baea-988757199bce', 'event', 'needs_review', 'Downtown Santa Barbara Saturday Farmers’ Market', 'Santa Barbara’s flagship Saturday market fills State and Carrillo with local growers, flowers, and buskers — the city’s freshest morning ritual.', 'food', 1, 'food_drink_event', 'downtown', 'downtown', 'State & Carrillo Streets (Carrillo St. between Chapala & Anacapa; State St. between Canon Perdido & Figueroa), Santa Barbara, CA 93101', 'free', false, false, '{morning}', '2026-06-27T08:00:00-07:00'::timestamptz, '2026-06-27T13:00:00-07:00'::timestamptz, NULL, 'placeholder', 'State & Carrillo Streets (Carrillo St. between Chapala & Anacapa; State St. between Canon Perdido & Figueroa) Santa Barbara', 'Rain or shine, 8 to 1; arrive early for eggs and the best berries, and grab parking on Anacapa, Haley, or Ortega.', '2026-06-23'::timestamptz, 'https://santabarbaraca.gov/press-releases/saturday-santa-barbara-certified-farmers-market-moves-new-location-september-28'),
  ('0577dfa8-07e1-5dfc-b81b-bdf602b5a344', 'event', 'needs_review', 'French Wave: Contempt (Le Mépris)', 'A French writer’s marriage frays while he doctors a film of The Odyssey for a brash American producer — screening in SBIFF’s French Wave at the Riviera.', 'arts', 1, 'arts_theater', 'riviera', NULL, 'SBIFF Riviera Theatre, 2044 Alameda Padre Serra, Santa Barbara, CA 93103', NULL, true, false, '{evening}', '2026-07-10T17:10:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'SBIFF Riviera Theatre Santa Barbara', 'Part of SBIFF’s two-week French Wave at the historic Riviera Theatre, up on the Riviera near the El Encanto.', '2026-06-23'::timestamptz, 'https://sbifftheatres.com/wave/'),
  ('6c2adc89-6856-5ca0-9040-181d06d25fcb', 'event', 'needs_review', 'French Wave: Six Days in Spring', 'A San Sebastián best-director winner: a mother improvises a Riviera getaway for her twins that becomes a tender end-of-innocence summer.', 'arts', 1, 'arts_theater', 'riviera', NULL, 'SBIFF Riviera Theatre, 2044 Alameda Padre Serra, Santa Barbara, CA 93103', NULL, true, false, '{afternoon}', '2026-07-12T14:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'SBIFF Riviera Theatre Santa Barbara', 'A French Wave screening at SBIFF’s year-round Riviera home; the festival runs two weeks of new French cinema.', '2026-06-23'::timestamptz, 'https://sbifftheatres.com/wave/'),
  ('a160e818-0be5-5a07-939d-e5a748a88f49', 'event', 'needs_review', 'Jackalope Indie Artisan Fair (Day 1)', 'An indie artisan fair takes over Alameda Park — 180-plus handmade makers, food trucks, live music, and hands-on crafts, free all weekend.', 'festival', 1, 'festival_fair', 'downtown', 'downtown', 'Alameda Park, 1400 Santa Barbara St, Santa Barbara, CA 93101', 'free', false, false, '{morning}', '2026-07-11T10:00:00-07:00'::timestamptz, '2026-07-11T17:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Alameda Park Santa Barbara', 'Free admission, rain or shine on the park lawn; leashed dogs welcome, with free street parking around Sola and Micheltorena.', '2026-06-23'::timestamptz, 'https://www.jackalopeartfair.com/santa-barbara-faq'),
  ('1d2ce5ee-2ff7-53fc-a993-bfe73bcb7aba', 'event', 'needs_review', 'Jackalope Indie Artisan Fair (Day 2)', 'Day two of the handmade takeover at Alameda Park: original fashion, jewelry, art, and food finds from local makers, with family crafts and live tunes.', 'festival', 1, 'festival_fair', 'downtown', 'downtown', 'Alameda Park, 1400 Santa Barbara St, Santa Barbara, CA 93101', 'free', false, false, '{morning}', '2026-07-12T10:00:00-07:00'::timestamptz, '2026-07-12T17:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Alameda Park Santa Barbara', 'Free and rain-or-shine on the grass; leashed dogs are fine, and there’s usually free street parking on Sola, Micheltorena, and Garden.', '2026-06-23'::timestamptz, 'https://www.jackalopeartfair.com/santa-barbara-faq');

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('98d33791-b5d3-5891-9a37-41bb506b5318', 'catch_a_show', 0.90, 'ai'),
  ('98d33791-b5d3-5891-9a37-41bb506b5318', 'date_night', 0.70, 'ai'),
  ('98d33791-b5d3-5891-9a37-41bb506b5318', 'nightlife', 0.60, 'ai'),
  ('a5752143-7a84-516d-9b7c-200d55cd56df', 'catch_a_show', 0.90, 'ai'),
  ('a5752143-7a84-516d-9b7c-200d55cd56df', 'family_day', 0.60, 'ai'),
  ('7edaa467-e671-5fcc-bf2d-0bba6b9b148a', 'catch_a_show', 0.90, 'ai'),
  ('7edaa467-e671-5fcc-bf2d-0bba6b9b148a', 'date_night', 0.60, 'ai'),
  ('751a860a-7d33-5f2f-84b8-95df002e0db3', 'catch_a_show', 0.90, 'ai'),
  ('751a860a-7d33-5f2f-84b8-95df002e0db3', 'nightlife', 0.60, 'ai'),
  ('909ee65f-c9bc-5745-af11-a628828d60d4', 'wine_food', 0.95, 'ai'),
  ('909ee65f-c9bc-5745-af11-a628828d60d4', 'date_night', 0.70, 'ai'),
  ('293e8b2a-4922-5867-89a8-5fb72072649c', 'wine_food', 0.95, 'ai'),
  ('293e8b2a-4922-5867-89a8-5fb72072649c', 'hosting_visitors', 0.60, 'ai'),
  ('9d9118db-8f64-52ad-8af9-dc09e0f21ffb', 'family_day', 0.90, 'ai'),
  ('9d9118db-8f64-52ad-8af9-dc09e0f21ffb', 'free_sb', 0.95, 'ai'),
  ('9d9118db-8f64-52ad-8af9-dc09e0f21ffb', 'hosting_visitors', 0.70, 'ai'),
  ('50747904-84fe-5b67-96dd-2ac007908639', 'arts_culture', 0.85, 'ai'),
  ('50747904-84fe-5b67-96dd-2ac007908639', 'family_day', 0.60, 'ai'),
  ('50747904-84fe-5b67-96dd-2ac007908639', 'free_sb', 0.90, 'ai'),
  ('e307dd70-2e6a-5bd0-baea-988757199bce', 'wine_food', 0.80, 'ai'),
  ('e307dd70-2e6a-5bd0-baea-988757199bce', 'family_day', 0.60, 'ai'),
  ('e307dd70-2e6a-5bd0-baea-988757199bce', 'free_sb', 0.90, 'ai'),
  ('0577dfa8-07e1-5dfc-b81b-bdf602b5a344', 'arts_culture', 0.90, 'ai'),
  ('0577dfa8-07e1-5dfc-b81b-bdf602b5a344', 'catch_a_show', 0.70, 'ai'),
  ('6c2adc89-6856-5ca0-9040-181d06d25fcb', 'arts_culture', 0.90, 'ai'),
  ('6c2adc89-6856-5ca0-9040-181d06d25fcb', 'catch_a_show', 0.70, 'ai'),
  ('a160e818-0be5-5a07-939d-e5a748a88f49', 'family_day', 0.80, 'ai'),
  ('a160e818-0be5-5a07-939d-e5a748a88f49', 'free_sb', 0.90, 'ai'),
  ('a160e818-0be5-5a07-939d-e5a748a88f49', 'arts_culture', 0.70, 'ai'),
  ('1d2ce5ee-2ff7-53fc-a993-bfe73bcb7aba', 'family_day', 0.80, 'ai'),
  ('1d2ce5ee-2ff7-53fc-a993-bfe73bcb7aba', 'free_sb', 0.90, 'ai'),
  ('1d2ce5ee-2ff7-53fc-a993-bfe73bcb7aba', 'arts_culture', 0.70, 'ai');

-- ============================================================================
-- BATCH 2 — Lobero Theatre
-- (source file: seed_events_batch2.sql)
-- ============================================================================
-- SB Daymaker seed — BATCH 2 (downtown theaters: Lobero) — 2026-06-23..2026-07-23 — needs_review — VERIFY before publishing
-- Idempotent: safe to run alongside Batch 1 (stable uuid5 ids + on conflict do nothing).


insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('fe7d3a68-df08-5e34-acbf-cd2b720a05dd', 'event', 'needs_review', 'Music Academy of the West: Teaching Artist Showcase – Bruch & Mendelssohn', 'Music Academy of the West faculty take the Lobero stage for an evening of Bruch and Mendelssohn.', 'music', 1, 'live_music', 'downtown', 'downtown', 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-02T19:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Lobero Theatre Santa Barbara', 'The Lobero is California’s oldest continuously operating theatre — an intimate 500-seat room where every seat is close to the stage.', '2026-06-23'::timestamptz, 'https://www.axs.com/venues/125974/lobero-theatre-santa-barbara-tickets'),
  ('c46b198e-aa85-5884-9ab1-29a26e20b19d', 'event', 'needs_review', 'The Magical Music of Motown', 'A high-spirited revue of Motown’s greatest hits comes to the historic Lobero.', 'music', 1, 'live_music', 'downtown', 'downtown', 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-11T20:00:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Lobero Theatre Santa Barbara', 'The Lobero is California’s oldest continuously operating theatre — an intimate 500-seat room where every seat is close to the stage.', '2026-06-23'::timestamptz, 'https://www.axs.com/venues/125974/lobero-theatre-santa-barbara-tickets'),
  ('069fc58d-aca5-5629-8962-0218d7314cbb', 'event', 'needs_review', 'Dave Alvin and Jimmie Dale Gilmore', 'Singer-songwriters Dave Alvin and Jimmie Dale Gilmore share the Lobero stage for an evening of song.', 'music', 1, 'live_music', 'downtown', 'downtown', 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-12T19:00:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Lobero Theatre Santa Barbara', 'The Lobero is California’s oldest continuously operating theatre — an intimate 500-seat room where every seat is close to the stage.', '2026-06-23'::timestamptz, 'https://www.axs.com/venues/125974/lobero-theatre-santa-barbara-tickets'),
  ('8a0cc5b5-bb41-536a-8128-3a1ee80ca7d4', 'event', 'needs_review', 'Jeremy Denk', 'Jeremy Denk takes the stage at the Lobero, California’s oldest continuously operating theatre.', 'music', 1, 'live_music', 'downtown', 'downtown', 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-15T19:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Lobero Theatre Santa Barbara', 'The Lobero is California’s oldest continuously operating theatre — an intimate 500-seat room where every seat is close to the stage.', '2026-06-23'::timestamptz, 'https://www.axs.com/venues/125974/lobero-theatre-santa-barbara-tickets'),
  ('e27d1cd5-2413-50c3-a04e-3cbc5e6393e8', 'event', 'needs_review', 'Wynton Marsalis Septet', 'The Wynton Marsalis Septet brings jazz to the Lobero — a room DownBeat has named one of the world’s best jazz venues.', 'music', 1, 'live_music', 'downtown', 'downtown', 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-16T19:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Lobero Theatre Santa Barbara', 'DownBeat has named the Lobero one of the world’s best jazz venues — and at about 500 seats, it’s an intimate room for it.', '2026-06-23'::timestamptz, 'https://www.axs.com/venues/125974/lobero-theatre-santa-barbara-tickets'),
  ('0de1007e-3e73-58e0-a626-046d159d142a', 'event', 'needs_review', 'Academy Chamber Orchestra: Copland, Barnes and Schumann', 'The Academy Chamber Orchestra performs Copland, Barnes, and Schumann at the historic Lobero.', 'music', 1, 'live_music', 'downtown', 'downtown', 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-18T19:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Lobero Theatre Santa Barbara', 'The Lobero is California’s oldest continuously operating theatre — an intimate 500-seat room where every seat is close to the stage.', '2026-06-23'::timestamptz, 'https://www.axs.com/venues/125974/lobero-theatre-santa-barbara-tickets')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('fe7d3a68-df08-5e34-acbf-cd2b720a05dd', 'catch_a_show', 0.85, 'ai'),
  ('fe7d3a68-df08-5e34-acbf-cd2b720a05dd', 'arts_culture', 0.80, 'ai'),
  ('c46b198e-aa85-5884-9ab1-29a26e20b19d', 'catch_a_show', 0.85, 'ai'),
  ('c46b198e-aa85-5884-9ab1-29a26e20b19d', 'date_night', 0.65, 'ai'),
  ('069fc58d-aca5-5629-8962-0218d7314cbb', 'catch_a_show', 0.85, 'ai'),
  ('069fc58d-aca5-5629-8962-0218d7314cbb', 'date_night', 0.60, 'ai'),
  ('8a0cc5b5-bb41-536a-8128-3a1ee80ca7d4', 'catch_a_show', 0.80, 'ai'),
  ('8a0cc5b5-bb41-536a-8128-3a1ee80ca7d4', 'arts_culture', 0.80, 'ai'),
  ('e27d1cd5-2413-50c3-a04e-3cbc5e6393e8', 'catch_a_show', 0.85, 'ai'),
  ('e27d1cd5-2413-50c3-a04e-3cbc5e6393e8', 'arts_culture', 0.80, 'ai'),
  ('0de1007e-3e73-58e0-a626-046d159d142a', 'catch_a_show', 0.85, 'ai'),
  ('0de1007e-3e73-58e0-a626-046d159d142a', 'arts_culture', 0.80, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 3 — Music Academy of the West
-- (source file: seed_events_batch3.sql)
-- ============================================================================
-- SB Daymaker seed — BATCH 3 (Music Academy of the West, Summer Festival) — 2026-06-23..2026-07-23 — needs_review
-- New rows only (3 MAW events already loaded under the Lobero in Batch 2 are skipped). Adds Montecito.
-- Idempotent: stable uuid5 ids + on conflict do nothing.


insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('f01ed125-18d4-5c68-903b-d51bed82f306', 'event', 'needs_review', 'Takács Quartet: András Fejér Finale', 'Cellist András Fejér takes his farewell in his 51st and final season with the celebrated Takács Quartet, in an all-Beethoven evening at the Lobero.', 'music', 1, 'live_music', 'downtown', 'downtown', 'Lobero Theatre, 33 E. Canon Perdido St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-06-27T19:30:00-07:00'::timestamptz, '2026-06-27T21:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Lobero Theatre Santa Barbara', 'András Fejér’s farewell after 51 seasons with the Takács — at the intimate, historic Lobero.', '2026-06-23'::timestamptz, 'https://santabarbaraca.com/events/takacs-quartet-andras-fejer-finale/'),
  ('e174af56-5b45-579d-85e2-f64222531e97', 'event', 'needs_review', 'Oh Beautiful: Songs from Home', 'The Music Academy’s Lehrer Vocal Institute fellows share an intimate evening of art songs from their home countries.', 'music', 1, 'live_music', 'montecito', 'montecito', 'Music Academy of the West, 1070 Fairway Road, Santa Barbara, CA 93108', NULL, false, false, '{evening}', '2026-07-01T19:30:00-07:00'::timestamptz, '2026-07-01T21:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Music Academy of the West Santa Barbara', 'On the Academy’s nine-acre Miraflores campus in Montecito — come early for a free pre-concert picnic on the gardens.', '2026-06-23'::timestamptz, 'https://santabarbaraca.com/events/oh-beautiful-songs-from-home/'),
  ('fe9f0c16-d2ff-5ad5-bac8-77926b7a49fe', 'event', 'needs_review', 'Academy Festival Orchestra: Gershwin & Brahms', 'The Academy Festival Orchestra opens the festival season with Gershwin and Brahms under conductor Miguel Harth-Bedoya.', 'music', 1, 'live_music', 'montecito', 'montecito', 'Music Academy of the West, 1070 Fairway Road, Santa Barbara, CA 93108', NULL, false, false, '{evening}', '2026-07-03T19:30:00-07:00'::timestamptz, '2026-07-03T21:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Music Academy of the West Santa Barbara', 'On the Academy’s nine-acre Miraflores campus in Montecito — come early for a free pre-concert picnic on the gardens.', '2026-06-23'::timestamptz, 'https://santabarbaraca.com/events/academy-festival-orchestra-gershwin-brahms/'),
  ('52507d64-5931-5145-9b82-78e9df3f65ad', 'event', 'needs_review', 'Family Concert: PercussionFest', 'Teaching artists Michael Werner and Joseph Pereira lead a hands-on, family-friendly afternoon of rhythm and percussion.', 'music', 1, 'live_music', 'montecito', 'montecito', 'Music Academy of the West, 1070 Fairway Road, Santa Barbara, CA 93108', NULL, true, false, '{afternoon}', '2026-07-08T16:00:00-07:00'::timestamptz, '2026-07-08T17:30:00-07:00'::timestamptz, NULL, 'placeholder', 'Music Academy of the West Santa Barbara', 'A family-friendly matinee in Hahn Hall — come early for a free picnic on the Miraflores gardens.', '2026-06-23'::timestamptz, 'https://santabarbaraca.com/events/family-concert-percussionfest/'),
  ('dbed193e-6dbf-5777-9500-d6c9d3eac0e2', 'event', 'needs_review', 'Academy Festival Orchestra: The Planets, An HD Odyssey', 'The Academy Festival Orchestra pairs a cosmic orchestral program with HD imagery for an awe-inspiring journey through the planets.', 'music', 1, 'live_music', 'montecito', 'montecito', 'Music Academy of the West, 1070 Fairway Road, Santa Barbara, CA 93108', NULL, false, false, '{evening}', '2026-07-11T19:30:00-07:00'::timestamptz, '2026-07-11T21:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Music Academy of the West Santa Barbara', 'On the Academy’s nine-acre Miraflores campus in Montecito — come early for a free pre-concert picnic on the gardens.', '2026-06-23'::timestamptz, 'https://santabarbaraca.com/events/academy-festival-orchestra-the-planets-an-hd-odyssey/'),
  ('a8487450-149b-5608-8cc1-9e6bb7f24b47', 'event', 'needs_review', 'The Art of the Duet: Opera Scenes', 'Lehrer Vocal Institute fellows perform unforgettable opera duets and scenes in an evening of passion and drama.', 'music', 1, 'live_music', 'montecito', 'montecito', 'Music Academy of the West, 1070 Fairway Road, Santa Barbara, CA 93108', NULL, true, false, '{evening}', '2026-07-14T19:30:00-07:00'::timestamptz, '2026-07-14T21:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Music Academy of the West Santa Barbara', 'On the Academy’s nine-acre Miraflores campus in Montecito — come early for a free pre-concert picnic on the gardens.', '2026-06-23'::timestamptz, 'https://santabarbaraca.com/events/the-art-of-the-duet-opera-scenes/')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('f01ed125-18d4-5c68-903b-d51bed82f306', 'catch_a_show', 0.85, 'ai'),
  ('f01ed125-18d4-5c68-903b-d51bed82f306', 'arts_culture', 0.85, 'ai'),
  ('e174af56-5b45-579d-85e2-f64222531e97', 'catch_a_show', 0.80, 'ai'),
  ('e174af56-5b45-579d-85e2-f64222531e97', 'arts_culture', 0.85, 'ai'),
  ('fe9f0c16-d2ff-5ad5-bac8-77926b7a49fe', 'catch_a_show', 0.85, 'ai'),
  ('fe9f0c16-d2ff-5ad5-bac8-77926b7a49fe', 'arts_culture', 0.85, 'ai'),
  ('52507d64-5931-5145-9b82-78e9df3f65ad', 'family_day', 0.85, 'ai'),
  ('52507d64-5931-5145-9b82-78e9df3f65ad', 'arts_culture', 0.70, 'ai'),
  ('dbed193e-6dbf-5777-9500-d6c9d3eac0e2', 'catch_a_show', 0.85, 'ai'),
  ('dbed193e-6dbf-5777-9500-d6c9d3eac0e2', 'arts_culture', 0.80, 'ai'),
  ('a8487450-149b-5608-8cc1-9e6bb7f24b47', 'catch_a_show', 0.80, 'ai'),
  ('a8487450-149b-5608-8cc1-9e6bb7f24b47', 'arts_culture', 0.85, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 4 — Museums / family
-- (source file: seed_events_batch4.sql)
-- ============================================================================
-- SB Daymaker seed — BATCH 4 (Museums / family) — 2026-06-23..2026-07-23 — needs_review
-- Adds Mission Canyon. SBMA address resolved from venue name (agreed relaxation).
-- Idempotent: stable uuid5 ids + on conflict do nothing.


insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('27c661ff-efcc-5dea-bccd-db53df499980', 'event', 'needs_review', 'Santa Barbara Wine Festival (38th Annual)', 'The Museum’s beloved 38th annual wine festival fills its oak-woodland grounds along Mission Creek with 80-plus Central Coast wineries and food purveyors — a 21+ afternoon benefiting its science education programs.', 'food', 1, 'food_drink_event', 'mission_canyon', NULL, 'Santa Barbara Museum of Natural History, 2559 Puesta del Sol, Santa Barbara, CA 93105', '$$$', false, true, '{afternoon}', '2026-06-27T14:00:00-07:00'::timestamptz, '2026-06-27T17:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Santa Barbara Museum of Natural History Santa Barbara', '21+ and outdoors under the oaks along Mission Creek; there’s free off-site parking with a shuttle to the door, and it sells out every year.', '2026-06-23'::timestamptz, 'https://www.independent.com/2026/04/09/santa-barbara-wine-festival-returns-celebrating-the-regions-remarkable-bounty/'),
  ('fe0f6cd5-1876-51b4-9448-6cf1f1eae9a3', 'event', 'needs_review', 'Summer Zoovies: Finding Nemo', 'Finding Nemo screens under the stars on the zoo’s hilltop, with a keeper talk on the animals beforehand — part of the SBIFF Summer Zoovies series.', 'arts', 1, 'arts_theater', 'waterfront', NULL, 'Santa Barbara Zoo, 500 Niños Drive, Santa Barbara, CA 93103', NULL, false, false, '{evening}', '2026-07-08T17:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Santa Barbara Zoo Santa Barbara', 'An outdoor family movie on the zoo’s hilltop with a keeper talk first — included with zoo admission that day.', '2026-06-23'::timestamptz, 'https://www.independent.com/2026/06/03/santa-barbara-summer-movie-mania/'),
  ('879dc4db-b092-5bbd-a097-df4065060b33', 'event', 'needs_review', 'The Astrology of Creative Vision: Dr. Jennifer Freed & Jane Lynch', 'Dr. Jennifer Freed and Jane Lynch explore creativity in “The Astrology of Creative Vision,” a Friday-evening conversation at the Santa Barbara Museum of Art.', 'arts', 1, 'arts_theater', 'downtown', 'downtown', 'Santa Barbara Museum of Art, 1130 State St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-10T17:00:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Santa Barbara Museum of Art Santa Barbara', NULL, '2026-06-23'::timestamptz, 'https://www.sbma.net/'),
  ('6150f319-a728-5d45-b79e-4f1370d65f50', 'event', 'needs_review', 'Sketching in the Galleries', 'Spend a guided hour sketching in the galleries at the Santa Barbara Museum of Art.', 'arts', 1, 'community_gathering', 'downtown', 'downtown', 'Santa Barbara Museum of Art, 1130 State St, Santa Barbara, CA 93101', NULL, true, false, '{afternoon}', '2026-07-11T11:15:00-07:00'::timestamptz, '2026-07-11T12:15:00-07:00'::timestamptz, NULL, 'placeholder', 'Santa Barbara Museum of Art Santa Barbara', NULL, '2026-06-23'::timestamptz, 'https://www.sbma.net/'),
  ('ae2113b6-9739-5dd0-850a-fb16b5fbf426', 'event', 'needs_review', 'Breathing Room: Gathering Stars (A Processional in Three Parts)', '“Breathing Room: Gathering Stars,” a processional performance in three parts, unfolds in the galleries at the Santa Barbara Museum of Art.', 'arts', 1, 'arts_theater', 'downtown', 'downtown', 'Santa Barbara Museum of Art, 1130 State St, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-12T17:00:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Santa Barbara Museum of Art Santa Barbara', NULL, '2026-06-23'::timestamptz, 'https://www.sbma.net/')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('27c661ff-efcc-5dea-bccd-db53df499980', 'wine_food', 0.95, 'ai'),
  ('27c661ff-efcc-5dea-bccd-db53df499980', 'hosting_visitors', 0.60, 'ai'),
  ('fe0f6cd5-1876-51b4-9448-6cf1f1eae9a3', 'family_day', 0.85, 'ai'),
  ('fe0f6cd5-1876-51b4-9448-6cf1f1eae9a3', 'arts_culture', 0.65, 'ai'),
  ('879dc4db-b092-5bbd-a097-df4065060b33', 'arts_culture', 0.85, 'ai'),
  ('879dc4db-b092-5bbd-a097-df4065060b33', 'date_night', 0.55, 'ai'),
  ('6150f319-a728-5d45-b79e-4f1370d65f50', 'arts_culture', 0.80, 'ai'),
  ('6150f319-a728-5d45-b79e-4f1370d65f50', 'family_day', 0.60, 'ai'),
  ('ae2113b6-9739-5dd0-850a-fb16b5fbf426', 'arts_culture', 0.80, 'ai'),
  ('ae2113b6-9739-5dd0-850a-fb16b5fbf426', 'catch_a_show', 0.60, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 5 — Outdoors / Goleta (free)
-- (source file: seed_events_batch5.sql)
-- ============================================================================
-- SB Daymaker seed — BATCH 5 (Outdoors / Goleta) — 2026-06-23..2026-07-23 — needs_review
-- 7 free outdoor rows. Adds Goleta (drone show). 2026 lineups confirmed (not stale 2025).
-- Idempotent: stable uuid5 ids + on conflict do nothing.


insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('fe2e6170-2fb9-5944-aac9-e29accb781fd', 'event', 'needs_review', 'Free Summer Cinema: Pretty in Pink', 'John Hughes’ coming-of-age classic Pretty in Pink screens free under the stars in the Courthouse Sunken Garden — part of the “Mixtapes & Misfits” summer series.', 'film', 1, 'arts_theater', 'downtown', 'downtown', 'Santa Barbara County Courthouse (Sunken Garden), 1100 Anacapa St, Santa Barbara, CA 93101', 'free', false, false, '{evening}', '2026-07-10T20:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Santa Barbara County Courthouse (Sunken Garden) Santa Barbara', 'Free and outdoors in the Courthouse Sunken Garden — locals start staking out spots from noon; bring a low-back chair or a permeable blanket (no tarps).', '2026-06-23'::timestamptz, 'https://artsandlectures.ucsb.edu/events-tickets/free-summer-cinema/'),
  ('9efd51ca-2d17-5c45-945b-221273ff1b3e', 'event', 'needs_review', 'Free Summer Cinema: Say Anything…', 'Cameron Crowe’s Say Anything… plays free under the stars in the Courthouse Sunken Garden, part of the “Mixtapes & Misfits” summer series.', 'film', 1, 'arts_theater', 'downtown', 'downtown', 'Santa Barbara County Courthouse (Sunken Garden), 1100 Anacapa St, Santa Barbara, CA 93101', 'free', false, false, '{evening}', '2026-07-17T20:30:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Santa Barbara County Courthouse (Sunken Garden) Santa Barbara', 'Free and outdoors in the Courthouse Sunken Garden — locals start staking out spots from noon; bring a low-back chair or a permeable blanket (no tarps).', '2026-06-23'::timestamptz, 'https://artsandlectures.ucsb.edu/events-tickets/free-summer-cinema/'),
  ('2643e7e7-3a18-575a-8918-265e8b016fff', 'event', 'needs_review', 'Goleta Fourth of July Drone Light Show', 'Goleta swaps fireworks for a synchronized drone show over Dos Pueblos High — a free, family-friendly Fourth with food trucks, a DJ, line dancing, and the lights at nightfall.', 'community', 1, 'community_gathering', 'goleta', 'goleta', 'Dos Pueblos High School, 7266 Alameda Ave, Goleta, CA 93117', 'free', false, false, '{evening}', '2026-07-04T18:00:00-07:00'::timestamptz, '2026-07-04T21:30:00-07:00'::timestamptz, NULL, 'placeholder', 'Dos Pueblos High School Santa Barbara', 'Goleta’s free Fourth of July party at Dos Pueblos High: gates at 6 with food trucks and a DJ, then a drone show (no fireworks) around 9:15. Take the free Costco-lot shuttle, and bring a blanket or low-back chair (no camping chairs or pets).', '2026-06-23'::timestamptz, 'https://www.cityofgoleta.org/play/fourth-of-july-drone-lights-show'),
  ('7fd62137-8a44-5f48-a4f1-18470ebff8ad', 'event', 'needs_review', 'Concerts in the Park: The New Vibe', 'Funk with a hip-hop twist from The New Vibe opens the free Concerts in the Park series on the Great Meadow by the waterfront.', 'music', 1, 'live_music', 'waterfront', 'waterfront', 'Chase Palm Park (Great Meadow), 236 East Cabrillo Blvd, Santa Barbara, CA 93101', 'free', false, false, '{evening}', '2026-07-02T18:00:00-07:00'::timestamptz, '2026-07-02T19:30:00-07:00'::timestamptz, NULL, 'placeholder', 'Chase Palm Park (Great Meadow) Santa Barbara', 'Free Thursday-night music on the Great Meadow by the beach — spots open up around late morning; bring a blanket or low-back chair (leashed dogs OK, no alcohol).', '2026-06-23'::timestamptz, 'https://www.independent.com/2026/06/08/concerts-in-the-park-series-returns-to-chase-palm-park-this-july-2/'),
  ('2338c2e8-16d7-55e8-9dc3-c290bdd4c41b', 'event', 'needs_review', 'Concerts in the Park: Jason Libs and The Liberation', 'Jason Libs and The Liberation bring rock from the ’70s to today to the free Thursday-night Concerts in the Park on the waterfront Great Meadow.', 'music', 1, 'live_music', 'waterfront', 'waterfront', 'Chase Palm Park (Great Meadow), 236 East Cabrillo Blvd, Santa Barbara, CA 93101', 'free', false, false, '{evening}', '2026-07-09T18:00:00-07:00'::timestamptz, '2026-07-09T19:30:00-07:00'::timestamptz, NULL, 'placeholder', 'Chase Palm Park (Great Meadow) Santa Barbara', 'Free Thursday-night music on the Great Meadow by the beach — spots open up around late morning; bring a blanket or low-back chair (leashed dogs OK, no alcohol).', '2026-06-23'::timestamptz, 'https://www.independent.com/2026/06/08/concerts-in-the-park-series-returns-to-chase-palm-park-this-july-2/'),
  ('928baf02-34be-56d1-a29d-166427ff0cb1', 'event', 'needs_review', 'Concerts in the Park: The Mighty Cash Cats', 'The Mighty Cash Cats play Johnny Cash hits and country classics at the free Concerts in the Park on the Great Meadow by the beach.', 'music', 1, 'live_music', 'waterfront', 'waterfront', 'Chase Palm Park (Great Meadow), 236 East Cabrillo Blvd, Santa Barbara, CA 93101', 'free', false, false, '{evening}', '2026-07-16T18:00:00-07:00'::timestamptz, '2026-07-16T19:30:00-07:00'::timestamptz, NULL, 'placeholder', 'Chase Palm Park (Great Meadow) Santa Barbara', 'Free Thursday-night music on the Great Meadow by the beach — spots open up around late morning; bring a blanket or low-back chair (leashed dogs OK, no alcohol).', '2026-06-23'::timestamptz, 'https://www.independent.com/2026/06/08/concerts-in-the-park-series-returns-to-chase-palm-park-this-july-2/'),
  ('15c6b792-4c36-59ae-a6e3-349a4c24b4dd', 'event', 'needs_review', 'Concerts in the Park: Spencer the Gardener', 'Spencer the Gardener closes the free Concerts in the Park series with an eclectic mix of pop and surf rock on the waterfront Great Meadow.', 'music', 1, 'live_music', 'waterfront', 'waterfront', 'Chase Palm Park (Great Meadow), 236 East Cabrillo Blvd, Santa Barbara, CA 93101', 'free', false, false, '{evening}', '2026-07-23T18:00:00-07:00'::timestamptz, '2026-07-23T19:30:00-07:00'::timestamptz, NULL, 'placeholder', 'Chase Palm Park (Great Meadow) Santa Barbara', 'Free Thursday-night music on the Great Meadow by the beach — spots open up around late morning; bring a blanket or low-back chair (leashed dogs OK, no alcohol).', '2026-06-23'::timestamptz, 'https://www.independent.com/2026/06/08/concerts-in-the-park-series-returns-to-chase-palm-park-this-july-2/')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('fe2e6170-2fb9-5944-aac9-e29accb781fd', 'free_sb', 0.95, 'ai'),
  ('fe2e6170-2fb9-5944-aac9-e29accb781fd', 'date_night', 0.60, 'ai'),
  ('fe2e6170-2fb9-5944-aac9-e29accb781fd', 'family_day', 0.55, 'ai'),
  ('9efd51ca-2d17-5c45-945b-221273ff1b3e', 'free_sb', 0.95, 'ai'),
  ('9efd51ca-2d17-5c45-945b-221273ff1b3e', 'date_night', 0.60, 'ai'),
  ('9efd51ca-2d17-5c45-945b-221273ff1b3e', 'family_day', 0.55, 'ai'),
  ('2643e7e7-3a18-575a-8918-265e8b016fff', 'free_sb', 0.95, 'ai'),
  ('2643e7e7-3a18-575a-8918-265e8b016fff', 'family_day', 0.80, 'ai'),
  ('7fd62137-8a44-5f48-a4f1-18470ebff8ad', 'free_sb', 0.95, 'ai'),
  ('7fd62137-8a44-5f48-a4f1-18470ebff8ad', 'family_day', 0.75, 'ai'),
  ('2338c2e8-16d7-55e8-9dc3-c290bdd4c41b', 'free_sb', 0.95, 'ai'),
  ('2338c2e8-16d7-55e8-9dc3-c290bdd4c41b', 'family_day', 0.75, 'ai'),
  ('928baf02-34be-56d1-a29d-166427ff0cb1', 'free_sb', 0.95, 'ai'),
  ('928baf02-34be-56d1-a29d-166427ff0cb1', 'family_day', 0.75, 'ai'),
  ('15c6b792-4c36-59ae-a6e3-349a4c24b4dd', 'free_sb', 0.95, 'ai'),
  ('15c6b792-4c36-59ae-a6e3-349a4c24b4dd', 'family_day', 0.75, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 6 — SOhO Restaurant & Music Club
-- (source file: seed_events_batch6.sql)
-- ============================================================================
-- SB Daymaker seed — BATCH 6 (SOhO Restaurant & Music Club) — 2026-06-23..2026-07-23 — needs_review
-- 2 confirmed shows (date+time from SOhO ticketing). buy_url + is_21_plus + price populated.
-- Idempotent: stable uuid5 ids + on conflict do nothing.


insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('3b23a4cf-ec2c-55a2-838f-b5b10fbb5b02', 'event', 'needs_review', 'Daft Punk Night', 'SOhO turns into a Daft Punk dance party for one night — hits, remixes, and French house classics with immersive visuals and a packed floor.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State St, Ste. 205, Santa Barbara, CA 93101', NULL, true, true, '{evening}', '2026-07-03T21:00:00-07:00'::timestamptz, NULL, 'https://www.ticketweb.com/event/daft-punk-night-soho-restaurant-music-club-tickets/14925883?pl=numbskullshows', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'A 21+ Daft Punk dance night at SOhO — French house, remixes, and electronic anthems with a packed floor; music at 9.', '2026-06-23'::timestamptz, 'https://tickets.sohosb.com/e/numbskull-presents-daft-punk-night'),
  ('3a3eca51-251e-5cfd-85bd-1a583f6267d4', 'event', 'needs_review', 'James McMurtry and The Martial Law Review', 'Texas singer-songwriter James McMurtry brings his sharp storytelling and full band — with BettySoo — to SOhO’s intimate State Street stage.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State St, Ste. 205, Santa Barbara, CA 93101', '$$', true, false, '{evening}', '2026-07-21T20:00:00-07:00'::timestamptz, NULL, 'https://tickets.sohosb.com/e/james-mcmurtry-and-the-martial-law-review/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'An 8 p.m. show upstairs at SOhO on State — cover is $35 cash-only at the door, and a dinner reservation gets you a table for the whole set.', '2026-06-23'::timestamptz, 'https://tickets.sohosb.com/e/james-mcmurtry-and-the-martial-law-review/tickets')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('3b23a4cf-ec2c-55a2-838f-b5b10fbb5b02', 'nightlife', 0.90, 'ai'),
  ('3b23a4cf-ec2c-55a2-838f-b5b10fbb5b02', 'date_night', 0.50, 'ai'),
  ('3a3eca51-251e-5cfd-85bd-1a583f6267d4', 'catch_a_show', 0.85, 'ai'),
  ('3a3eca51-251e-5cfd-85bd-1a583f6267d4', 'date_night', 0.50, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 7 — Funk Zone Tier-3 PLACES
-- (source file: seed_funkzone_places_batch7.sql)
-- ============================================================================
-- SB Daymaker seed — BATCH 7 (Funk Zone Tier-3 PLACES) — needs_review
-- 15 Google-Places-verified venues. type='place', happening_tier=3, reason_to_go required.
-- place_id + lat/lng pre-loaded (Phase-8 image pipeline can resolve photos immediately).
-- Idempotent: stable uuid5 ids + on conflict do nothing.


insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('2cc96eca-454f-5254-9b15-893f4ec48267', 'place', 'needs_review', 'Topa Topa Brewing Co.', 'An Ojai-founded craft brewery in the airy, shared Waterline space.', 'drink', 3, 'food_drink_spot', 'Sip core beers like Chief Peak in a bright, dog-friendly taproom, with food from The Nook next door.', 'funk_zone', 'funk', '120 Santa Barbara St, Santa Barbara, CA 93101', 34.4157869, -119.688601, NULL, true, false, '{afternoon,evening}', 'ChIJYZcJ5I4T6YARr4QDkK7H8fc', 'placeholder', 'Topa Topa Brewing Co. Santa Barbara Funk Zone', 'Shares the Waterline space with Fox Wine, Lama Dog, and The Nook eatery.', '2026-06-23'::timestamptz, 'seed:google_places'),
  ('9b55d7dc-27ae-55ba-8e29-7e5a9f3c5552', 'place', 'needs_review', 'Fox Wine Co.', 'A Funk Zone wine tasting room inside the shared Waterline space.', 'drink', 3, 'food_drink_spot', 'Taste Blair Fox’s small-lot Central Coast wines on the shared courtyard patio.', 'funk_zone', 'funk', '120 Santa Barbara St, Santa Barbara, CA 93101', 34.4158022, -119.688585, NULL, true, false, '{afternoon,evening}', 'ChIJAXb1444T6YAR979OgkVVkig', 'placeholder', 'Fox Wine Co. Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('2fe78b23-c2aa-52ab-8255-0188af5fbc78', 'place', 'needs_review', 'Figueroa Mountain Brewing Co. (Santa Barbara)', 'A Santa Ynez Valley brewery’s Funk Zone taproom with indoor and patio seating.', 'drink', 3, 'food_drink_spot', 'Grab a flight of Santa Ynez Valley beers, often with live music on the patio.', 'funk_zone', 'funk', '137 Anacapa St F, Santa Barbara, CA 93101', 34.4146167, -119.6908271, NULL, true, false, '{afternoon,evening}', 'ChIJdyDjM4kT6YAROBohDMF09xc', 'placeholder', 'Figueroa Mountain Brewing Co. (Santa Barbara) Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('e09431a0-ac20-509c-8af2-653e0735099c', 'place', 'needs_review', 'Validation Ale', 'A clever, family-friendly Funk Zone brewery and distillery.', 'drink', 3, 'food_drink_spot', 'Order a flight and the smash burger; catch live music, comedy, or trivia.', 'funk_zone', 'funk', '102 E Yanonali St, Santa Barbara, CA 93101', 34.4150493, -119.6900731, NULL, true, false, '{afternoon,evening}', 'ChIJ17PFLisT6YARDdnhDQ7boH0', 'placeholder', 'Validation Ale Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('6e90f0d7-e4c3-53d8-a10c-b4030de9b747', 'place', 'needs_review', 'Santa Barbara Wine Collective', 'An industrial-chic tasting room pouring a range of local producers.', 'drink', 3, 'food_drink_spot', 'Taste across many local producers in one industrial-chic room (a morning bakery, too).', 'funk_zone', 'funk', '131 Anacapa St c, Santa Barbara, CA 93101', 34.4144089, -119.6907174, '$$', true, false, '{afternoon,evening}', 'ChIJpQurNYkT6YARMAkHcbSGM7o', 'placeholder', 'Santa Barbara Wine Collective Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('13549c41-575d-5a5e-b05a-e79dd2541a3f', 'place', 'needs_review', 'Pali Wine Co.', 'A relaxed Funk Zone tasting room for small-lot Pinot and Chardonnay.', 'drink', 3, 'food_drink_spot', 'Sample Pinot and Chardonnay flights on the board, with patio live music.', 'funk_zone', 'funk', '205 Anacapa St, Santa Barbara, CA 93101', 34.4151443, -119.6908837, NULL, true, false, '{afternoon,evening}', 'ChIJSy8Ki_AT6YARwLytg-Xpd1s', 'placeholder', 'Pali Wine Co. Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('3bf44b2f-712c-58cc-9889-a182ff7e14f4', 'place', 'needs_review', 'Corks n'' Crowns', 'A cozy, fireside wine-and-beer tasting room.', 'drink', 3, 'food_drink_spot', 'Cozy up by the fire for wine or beer tastings with nightly live music.', 'funk_zone', 'funk', '32 Anacapa St, Santa Barbara, CA 93101', 34.4140636, -119.6889098, NULL, true, false, '{afternoon,evening}', 'ChIJQ0s4mI4T6YAReMbuC1q4Lxg', 'placeholder', 'Corks n'' Crowns Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('aa412e49-b210-5c9c-9472-6143dc5206d0', 'place', 'needs_review', 'Riverbench Santa Barbara Tasting Room', 'A quaint Funk Zone tasting room for estate Santa Maria Valley wines.', 'drink', 3, 'food_drink_spot', 'Taste estate Chardonnay, Pinot Noir, and sparkling in a quaint room.', 'funk_zone', 'funk', '137 Anacapa St, Santa Barbara, CA 93101', 34.4147383, -119.690662, NULL, true, false, '{afternoon,evening}', 'ChIJT_AHM4kT6YAR7aDHNDYStwg', 'placeholder', 'Riverbench Santa Barbara Tasting Room Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('333a4318-808b-5f32-9427-448c016d8447', 'place', 'needs_review', 'Brass Bear Funk Zone', 'A Funk Zone brewpub and beer garden with a large patio.', 'drink', 3, 'food_drink_spot', 'House beer and the Funk Zone grilled cheese on a big, mountain-view patio.', 'funk_zone', 'funk', '28 Anacapa St Unit e, Santa Barbara, CA 93101', 34.4142488, -119.6885277, '$$', true, false, '{afternoon,evening}', 'ChIJTYmdkI4T6YARlyu02RqW7kg', 'placeholder', 'Brass Bear Funk Zone Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('7789d52a-4830-5cdc-9cb8-6ef26afe8787', 'place', 'needs_review', 'Test Pilot', 'A tropical cocktail bar a block from the waterfront.', 'drink', 3, 'food_drink_spot', 'Tropical cocktails and an easy beach-bar vibe just off the waterfront.', 'funk_zone', 'funk', '211 Helena Ave, Santa Barbara, CA 93101', 34.4145846, -119.691413, '$$', true, false, '{evening,late}', 'ChIJEUwCO4kT6YARAHBjZfVSTPY', 'placeholder', 'Test Pilot Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('581f1481-3f8a-56c6-ab74-f31f8aab9666', 'place', 'needs_review', 'The Lark', 'A seasonal, market-driven flagship restaurant in the Funk Zone.', 'food', 3, 'food_drink_spot', 'Share seasonal, market-driven small plates at the Funk Zone’s flagship dinner spot.', 'funk_zone', 'funk', '131 Anacapa St, Santa Barbara, CA 93101', 34.414624, -119.6904907, '$$$', true, false, '{evening}', 'ChIJTxEHzY4T6YAReL8d5SD22T4', 'placeholder', 'The Lark Santa Barbara Funk Zone', 'Dishes are shareable small plates — plan on several for a full meal.', '2026-06-23'::timestamptz, 'seed:google_places'),
  ('d3117c6d-c791-54bb-87c7-556a20b64897', 'place', 'needs_review', 'Loquita', 'A lively Spanish restaurant near the waterfront.', 'food', 3, 'food_drink_spot', 'Spanish tapas and paella with lovely garden seating near the waterfront.', 'funk_zone', 'funk', '202 State St, Santa Barbara, CA 93101', 34.4141989, -119.6916317, '$$$', true, false, '{evening}', 'ChIJ44HSPokT6YARqItXAqO9-Cc', 'placeholder', 'Loquita Santa Barbara Funk Zone', NULL, '2026-06-23'::timestamptz, 'seed:google_places'),
  ('d7b34405-20b1-54b8-95f3-87ac0eece025', 'place', 'needs_review', 'Lucky Penny', 'A wood-fired pizza spot with a string-lit, penny-tiled patio.', 'food', 3, 'food_drink_spot', 'Wood-fired pizza on a string-lit, penny-tiled patio — a family favorite.', 'funk_zone', 'funk', '127 Anacapa St, Santa Barbara, CA 93101', 34.4146371, -119.6902356, '$$', false, false, '{afternoon,evening}', 'ChIJdZu7NIkT6YARk0s2hMDHf7w', 'placeholder', 'Lucky Penny Santa Barbara Funk Zone', 'Seating is outdoor-only — seat yourself and they bring it out.', '2026-06-23'::timestamptz, 'seed:google_places'),
  ('8e309567-4ee0-5324-894c-7b0d8d664724', 'place', 'needs_review', 'Helena Avenue Bakery', 'A homestyle artisan bakery and café in the Funk Zone.', 'food', 3, 'food_drink_spot', 'Pastries, brick-sized hash browns, and a standout breakfast sandwich.', 'funk_zone', 'funk', '131 Anacapa St c, Santa Barbara, CA 93101', 34.4144454, -119.6906825, '$$', true, false, '{morning,afternoon}', 'ChIJiQyrNYkT6YARBBrar5EOdLM', 'placeholder', 'Helena Avenue Bakery Santa Barbara Funk Zone', 'Counter service; open mornings through mid-afternoon.', '2026-06-23'::timestamptz, 'seed:google_places'),
  ('1a8ebff3-ee4e-529b-ada4-3115be3e2d4f', 'place', 'needs_review', 'MOXI, The Wolf Museum of Exploration + Innovation', 'A hands-on science and innovation museum with three floors and a rooftop.', 'culture', 3, 'culture_spot', 'Three floors of hands-on science and a rooftop water-play deck — a hit with kids.', 'funk_zone', 'funk', '125 State St, Santa Barbara, CA 93101', 34.4134819, -119.6916514, NULL, true, false, '{morning,afternoon}', 'ChIJJzIlQ4kT6YARalmZWIsdFBM', 'placeholder', 'MOXI, The Wolf Museum of Exploration + Innovation Santa Barbara Funk Zone', 'A rooftop water-play deck and a toddler area make it great for families.', '2026-06-23'::timestamptz, 'seed:google_places')
on conflict (id) do nothing;

-- ============================================================================
-- BATCH 8 — SOhO Restaurant & Music Club (the "long tail" left for the feed)
-- Source: tickets.sohosb.com per-event detail pages (server-rendered date/time/ages).
-- Downtown. type='event', happening_tier=1. price_band=NULL where the detail page
-- did not publish a price (per rule: a null OPTIONAL field never drops a row; the
-- /tickets page holds price but was not used as the timing source). buy_url = the
-- venue's own /tickets page.
-- ============================================================================
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('63656b75-6cd0-5c5b-89bc-11819bfb251a', 'event', 'needs_review', 'Israel Vibration & Roots Radics with Benny Ranks', 'Foundation roots-reggae royalty: Israel Vibration backed by the legendary Roots Radics, with Benny Ranks, for a deep-rockers night at SOhO.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, true, '{evening}', '2026-06-25T20:30:00-07:00'::timestamptz, NULL, 'https://tickets.sohosb.com/e/israel-vibrations-roots-radics-with-benny-ranks/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'Up the stairs at 1221 State; doors 7:30, show 8:30. GA standing up front, dinner tables behind in the stage room.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/israel-vibrations-roots-radics-with-benny-ranks'),
  ('e21037ee-1a57-57a3-b888-5acac98ff15a', 'event', 'needs_review', 'No Simple Highway: 12 Year Anniversary Show', 'The beloved Grateful Dead tribute marks twelve years with a long, loose night of Dead classics at SOhO.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, true, '{evening}', '2026-07-11T20:30:00-07:00'::timestamptz, NULL, 'https://tickets.sohosb.com/e/an-evening-with-no-simple-highway-soho-2/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'Doors 7:30, show 8:30; GA standing in the stage room, dinner tables in the back bar.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/an-evening-with-no-simple-highway-soho-2'),
  ('9d9528ca-be02-5b5e-9421-b893aa9092cd', 'event', 'needs_review', 'Santa Barbara Jazz Society Presents: Jazz Duende with Tony Ybarra', 'Flamenco meets jazz: guitarist Tony Ybarra leads an afternoon of compás, groove, and improvisation with flute, guitar, bass, and percussion.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, false, '{afternoon}', '2026-07-12T13:00:00-07:00'::timestamptz, '2026-07-12T16:00:00-07:00'::timestamptz, NULL, 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'An all-ages Sunday matinee; doors 12:30, music 1–4. Tickets at the door on day of show only.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/santa-barbara-jazz-society-presents-tony-ybarra-4'),
  ('fee0bcc8-cdb1-534b-bf8a-b4bddd076741', 'event', 'needs_review', 'Molly Miller Trio', 'Acclaimed guitarist Dr. Molly Miller brings her groove-driven blend of Americana, jazz, and roots music to SOhO for an early-evening set.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, false, '{evening}', '2026-07-12T19:00:00-07:00'::timestamptz, NULL, 'https://tickets.sohosb.com/e/molly-miller-trio/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'All ages; doors 6, show 7. Dinner tables in the stage room — book a table to eat during the set.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/molly-miller-trio'),
  ('e4a2ec92-aa69-5dad-b48d-64ab117e2302', 'event', 'needs_review', 'A Night with Morillo, Evan Hatfield, & Mycelial', 'A boundary-blurring night of electronic, dub, and world music — Morillo, electric-sitar artist Evan Hatfield, and banjo-driven Mycelial.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, true, '{evening}', '2026-07-16T20:00:00-07:00'::timestamptz, NULL, 'https://tickets.sohosb.com/e/morillo-evan-hatfield-mycelial/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'Doors 7, show 8; GA standing in the stage room, dinners in the back bar.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/morillo-evan-hatfield-mycelial'),
  ('df39c67b-09cf-5a53-9bd1-d21d2e1dccdf', 'event', 'needs_review', 'Jah Ollin with Koalishon & Heavy Rotation', 'A homegrown reggae bill: Jah Ollin headlines with Koalishon and Heavy Rotation for a late-night skank at SOhO.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, true, '{evening}', '2026-07-17T21:00:00-07:00'::timestamptz, NULL, 'https://tickets.sohosb.com/e/jah-ollin-with-koalishon-heavy-rotation/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'Doors 8, show 9; GA standing in the stage room, dinners in the back bar room.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/jah-ollin-with-koalishon-heavy-rotation'),
  ('caf4c75e-9f13-5ec6-981c-907c7206b8ab', 'event', 'needs_review', 'James McMurtry and The Martial Law Review with BettySoo', 'The fiercely literate Texas songwriter tours his new album The Black Dog and the Wandering Boy, with his band and special guest BettySoo.', 'music', 1, 'live_music', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, true, '{evening}', '2026-07-21T20:00:00-07:00'::timestamptz, NULL, 'https://tickets.sohosb.com/e/james-mcmurtry-and-the-martial-law-review/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'Doors 7, show 8; GA standing in front, dinner tables behind in the stage room.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/james-mcmurtry-and-the-martial-law-review'),
  ('3da90afb-ce5b-543d-bba5-7b5efc192df6', 'event', 'needs_review', 'ME Sabor Presents: Salsa Night (July 4)', 'Two dance floors, a full bar, and an outdoor patio for a Fourth-of-July night of salsa, bachata, cumbia, and merengue — class at 9, then dancing.', 'community', 1, 'community_gathering', 'downtown', 'downtown', 'SOhO Restaurant & Music Club, 1221 State Street, Santa Barbara, CA 93101', NULL, true, true, '{evening}', '2026-07-04T21:00:00-07:00'::timestamptz, '2026-07-04T23:59:00-07:00'::timestamptz, 'https://tickets.sohosb.com/e/me-sabor-presents-july-4-salsa-nigh-6/tickets', 'placeholder', 'SOhO Restaurant Music Club Santa Barbara', 'Doors 8:30; salsa class begins at 9, then open dancing. Two dance floors, full bar, outdoor patio.', '2026-06-24'::timestamptz, 'https://tickets.sohosb.com/e/me-sabor-presents-july-4-salsa-nigh-6')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('63656b75-6cd0-5c5b-89bc-11819bfb251a', 'catch_a_show', 0.90, 'ai'),
  ('63656b75-6cd0-5c5b-89bc-11819bfb251a', 'nightlife', 0.65, 'ai'),
  ('e21037ee-1a57-57a3-b888-5acac98ff15a', 'catch_a_show', 0.90, 'ai'),
  ('e21037ee-1a57-57a3-b888-5acac98ff15a', 'nightlife', 0.60, 'ai'),
  ('9d9528ca-be02-5b5e-9421-b893aa9092cd', 'catch_a_show', 0.85, 'ai'),
  ('9d9528ca-be02-5b5e-9421-b893aa9092cd', 'arts_culture', 0.75, 'ai'),
  ('fee0bcc8-cdb1-534b-bf8a-b4bddd076741', 'catch_a_show', 0.85, 'ai'),
  ('fee0bcc8-cdb1-534b-bf8a-b4bddd076741', 'date_night', 0.55, 'ai'),
  ('e4a2ec92-aa69-5dad-b48d-64ab117e2302', 'catch_a_show', 0.85, 'ai'),
  ('e4a2ec92-aa69-5dad-b48d-64ab117e2302', 'nightlife', 0.65, 'ai'),
  ('df39c67b-09cf-5a53-9bd1-d21d2e1dccdf', 'catch_a_show', 0.85, 'ai'),
  ('df39c67b-09cf-5a53-9bd1-d21d2e1dccdf', 'nightlife', 0.70, 'ai'),
  ('caf4c75e-9f13-5ec6-981c-907c7206b8ab', 'catch_a_show', 0.90, 'ai'),
  ('caf4c75e-9f13-5ec6-981c-907c7206b8ab', 'date_night', 0.55, 'ai'),
  ('3da90afb-ce5b-543d-bba5-7b5efc192df6', 'nightlife', 0.85, 'ai'),
  ('3da90afb-ce5b-543d-bba5-7b5efc192df6', 'date_night', 0.60, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 9 — CARPINTERIA  (new neighborhood)
-- (a) One Tier-1 dated event: the Arts Center FREE Summer Concert Series night
--     that lands in-window (The Rincons, Jul 18). The series' other dates
--     (Jun 20 past; Aug 15 / Sep 19 / Oct 17 out of window) are intentionally
--     omitted from this window's seed.
-- (b) One Tier-2 RECURRING market (the Thursday Carpinteria Certified Farmers'
--     Market) modeled as a base things row + a recurring_schedules row. This is
--     the FIRST Tier-2 row in the seed and demonstrates the recurring pattern.
-- (c) Three Tier-3 places (Google-Places-verified; place_id + lat/lng preloaded).
-- ============================================================================

-- (a) Tier-1 event ----------------------------------------------------------
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('6fbb45ab-38d9-5c7d-b406-6cd5a342141b', 'event', 'needs_review', 'Summer Concert Series: The Rincons', 'The Carpinteria Arts Center''s free Saturday summer concert brings local favorites The Rincons to downtown Linden Avenue for an all-ages evening of music.', 'music', 1, 'live_music', 'carpinteria', NULL, 'Lynda Fairly Carpinteria Arts Center, 865 Linden Ave, Carpinteria, CA 93013', 'free', false, false, '{evening}', '2026-07-18T18:00:00-07:00'::timestamptz, '2026-07-18T21:00:00-07:00'::timestamptz, NULL, 'placeholder', 'Carpinteria Arts Center Linden Avenue', 'Free, all ages, 6–9 p.m. on Linden; snacks and drinks for sale benefit the Arts Center. About 12 miles down the 101 from Santa Barbara.', '2026-06-24'::timestamptz, 'https://carpinteriaartscenter.org/summerconcert')
on conflict (id) do nothing;

-- (b) Tier-2 recurring market (base row + schedule) -------------------------
-- NOTE: happening_tier stored as 2 (base). reason_to_go included so it reads as
-- an activity, not a bare listing. The Thursday rhythm lives in recurring_schedules.
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, photo_source, photo_query, local_note, last_confirmed, source) values
  ('47186eee-86be-5255-86d4-6d4cc80b8b3f', 'event', 'needs_review', 'Carpinteria Certified Farmers'' Market', 'A laid-back, intimate Thursday-afternoon market on Linden Avenue with 20–30 local growers — avocados, citrus, flowers, and prepared foods, eight blocks up from the beach.', 'food', 2, 'recurring_market', 'Stroll the 800 block of Linden for just-picked Carpinteria-valley produce, cut flowers, and a small-town beach-town vibe.', 'carpinteria', NULL, '800 block of Linden Avenue (between 8th & 9th), Carpinteria, CA 93013', 'free', false, false, '{afternoon}', 'placeholder', 'Carpinteria farmers market Linden Avenue', 'Year-round, rain or shine, Thursday afternoons. Accepts CalFresh EBT, WIC, and cards. FLAG: end time varies by source (Visit SB 6 p.m.; some vendor pages 5:30 p.m.).', '2026-06-24'::timestamptz, 'https://santabarbaraca.com/plan-your-trip/food-drink/farm-stands-and-u-pick/')
on conflict (id) do nothing;

insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
  ('47186eee-86be-5255-86d4-6d4cc80b8b3f', 'recurring_market', 4, '14:30', '18:00', 'Carpinteria Thursday Market', '2026-06-24')
on conflict (thing_id, day_of_week, category) do nothing;

-- (c) Tier-3 places ---------------------------------------------------------
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('71d3f669-8b61-5c8e-9e3b-10197de16962', 'place', 'needs_review', 'Island Brewing Company', 'A family-run, award-winning microbrewery tucked beside the railroad tracks near Carpinteria''s beach and train station.', 'drink', 3, 'food_drink_spot', 'Grab a flight of creative, affordable craft beers on the patio at sunset, often with live music and a food truck out back.', 'carpinteria', NULL, '5049 6th St, Carpinteria, CA 93013', 34.3952922, -119.5217635, NULL, false, false, '{afternoon,evening}', 'ChIJleA7QNcO6YARd6Fy55sdnnI', 'placeholder', 'Island Brewing Company Carpinteria', 'Down a short railroad corridor near the Carpinteria train station; kid- and dog-friendly, with a food truck on the back patio.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('8855af04-9fba-5905-be22-c5365eb000f7', 'place', 'needs_review', 'Rincon Brewery', 'A popular Carpinteria brewpub with a varied, well-loved menu and a patio for outside dining.', 'food', 3, 'food_drink_spot', 'Pair house beers with standout wings, smash burgers, and a strong weekday happy hour.', 'carpinteria', NULL, '5065 Carpinteria Ave, Carpinteria, CA 93013', 34.3983747, -119.5179902, '$$', true, false, '{afternoon,evening}', 'ChIJ42_5SdEO6YARl0_6K0gaaaM', 'placeholder', 'Rincon Brewery Carpinteria', 'Industrial-upscale brewpub with an outdoor patio; Mon–Thu happy hour. (Note: this is the Carpinteria brewpub, not a Funk Zone venue.)', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('2c6df083-2f9f-5787-a67f-c7eba564dbec', 'place', 'needs_review', 'Third Window Brewing Carpinteria', 'A modern, well-designed brewery and kitchen on Linden with indoor seating, a fireplace, and an upstairs view deck.', 'food', 3, 'food_drink_spot', 'Settle in for hyped house beers and one of the area''s best cheeseburgers, indoors by the fire or up on the deck.', 'carpinteria', NULL, '720 Linden Ave, Carpinteria, CA 93013', 34.3971446, -119.5201599, NULL, true, false, '{afternoon,evening}', 'ChIJsWaXPAAP6YARXpH-Jtm5iXM', 'placeholder', 'Third Window Brewing Carpinteria', 'Kid- and pet-friendly; indoor and outdoor seating plus an upstairs view space. Initial service line can be long.', '2026-06-24'::timestamptz, 'seed:google_places')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('6fbb45ab-38d9-5c7d-b406-6cd5a342141b', 'free_sb', 0.95, 'ai'),
  ('6fbb45ab-38d9-5c7d-b406-6cd5a342141b', 'family_day', 0.80, 'ai'),
  ('6fbb45ab-38d9-5c7d-b406-6cd5a342141b', 'catch_a_show', 0.70, 'ai'),
  ('47186eee-86be-5255-86d4-6d4cc80b8b3f', 'free_sb', 0.90, 'ai'),
  ('47186eee-86be-5255-86d4-6d4cc80b8b3f', 'family_day', 0.75, 'ai'),
  ('47186eee-86be-5255-86d4-6d4cc80b8b3f', 'wine_food', 0.60, 'ai'),
  ('71d3f669-8b61-5c8e-9e3b-10197de16962', 'wine_food', 0.70, 'ai'),
  ('71d3f669-8b61-5c8e-9e3b-10197de16962', 'family_day', 0.55, 'ai'),
  ('8855af04-9fba-5905-be22-c5365eb000f7', 'wine_food', 0.70, 'ai'),
  ('8855af04-9fba-5905-be22-c5365eb000f7', 'family_day', 0.55, 'ai'),
  ('2c6df083-2f9f-5787-a67f-c7eba564dbec', 'wine_food', 0.70, 'ai'),
  ('2c6df083-2f9f-5787-a67f-c7eba564dbec', 'family_day', 0.55, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 10 — MESA + UPPER STATE  (two new neighborhoods, Tier-3 places)
-- Google-Places-verified anchors. The Mesa and Upper State are place-dense but
-- event-sparse (the Funk Zone pattern), so they seed as Tier-3 venues.
-- NOTE: nearby_zone — 'mesa' exists in the enum and is used for the two Mesa
-- rows; there is NO 'upper_state' nearby_zone, so the two upper-State rows leave
-- nearby_zone NULL (neighborhood='upper_state' still scopes them correctly).
-- ============================================================================
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('d65be929-e6c3-578a-afdf-2825ba0fdf2e', 'place', 'needs_review', 'Mesa Cafe & Bar', 'A friendly, long-running neighborhood spot on Cliff Drive serving all-day breakfast, lunch, and inexpensive drinks.', 'food', 3, 'food_drink_spot', 'Settle in for a Santa Barbara omelette or classic Benedict — lunch served anytime — in a cheerful Mesa local''s haunt.', 'mesa', 'mesa', '1972 Cliff Dr, Santa Barbara, CA 93109', 34.4022247, -119.7228315, '$$', true, false, '{morning,afternoon}', 'ChIJ91aGGEEU6YARC0GqNOiO6z0', 'placeholder', 'Mesa Cafe Bar Cliff Drive Santa Barbara', 'A Mesa staple known for warm service and regulars; breakfast and lunch only (kitchen closes mid-afternoon).', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('ad54c1d7-e7a5-599c-b99d-f60bff70eef8', 'place', 'needs_review', 'Lighthouse Coffee (Mesa)', 'A bright, modern Mesa coffee shop with in-house roasting, generous seating, and a cozy patio.', 'food', 3, 'culture_spot', 'Linger over a well-pulled latte and an almond croissant with plenty of room to work or read.', 'mesa', 'mesa', '1819 Cliff Dr C, Santa Barbara, CA 93109', 34.4010923, -119.7214959, NULL, true, false, '{morning,afternoon}', 'ChIJhd6fq-sV6YARx0w0CEnvD9c', 'placeholder', 'Lighthouse Coffee Mesa Cliff Drive Santa Barbara', 'Open 6 a.m.–4 p.m. daily; ample seating and parking, popular with remote workers.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('d9e50988-f356-5bf7-8962-4e0c9e46822e', 'place', 'needs_review', 'Boathouse at Hendry''s Beach', 'A beloved beachfront seafood restaurant right on the sand at Hendry''s Beach (Arroyo Burro), with patio heaters and ocean views.', 'food', 3, 'food_drink_spot', 'Book a sunset table on the sand for fresh seafood and cocktails with your feet practically in the Pacific.', 'mesa', 'mesa', '2981 Cliff Dr, Santa Barbara, CA 93109', 34.4032167, -119.7438563, '$$', false, false, '{afternoon,evening}', 'ChIJ86jqvLIV6YARL_CzQ8bY3es', 'placeholder', 'Boathouse Hendrys Beach Santa Barbara', 'On the sand at Arroyo Burro / Hendry''s Beach; reservations recommended, especially for sunset. Dog-friendly beach next door.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'place', 'needs_review', 'Lure Fish House', 'A well-regarded seafood restaurant at La Cumbre Plaza on upper State, known for sustainable fish, oysters, and complimentary hot sourdough.', 'food', 3, 'food_drink_spot', 'Come for fresh, sustainable seafood and charbroiled oysters — and the hot sourdough that regulars come back for.', 'upper_state', NULL, '3815 State St Suite G131, Santa Barbara, CA 93105', 34.4387112, -119.7480354, '$$$', true, false, '{afternoon,evening}', 'ChIJQXcSqSYV6YARG-FytD6Z4A8', 'placeholder', 'Lure Fish House upper State Santa Barbara', 'In La Cumbre Plaza on upper State; lively bar with a good happy-hour menu, plus a quieter patio.', '2026-06-24'::timestamptz, 'seed:google_places')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('d65be929-e6c3-578a-afdf-2825ba0fdf2e', 'family_day', 0.65, 'ai'),
  ('d65be929-e6c3-578a-afdf-2825ba0fdf2e', 'solo', 0.50, 'ai'),
  ('ad54c1d7-e7a5-599c-b99d-f60bff70eef8', 'solo', 0.70, 'ai'),
  ('ad54c1d7-e7a5-599c-b99d-f60bff70eef8', 'family_day', 0.50, 'ai'),
  ('d9e50988-f356-5bf7-8962-4e0c9e46822e', 'date_night', 0.75, 'ai'),
  ('d9e50988-f356-5bf7-8962-4e0c9e46822e', 'hosting_visitors', 0.70, 'ai'),
  ('d9e50988-f356-5bf7-8962-4e0c9e46822e', 'wine_food', 0.60, 'ai'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'wine_food', 0.75, 'ai'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'date_night', 0.60, 'ai'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'hosting_visitors', 0.55, 'ai')
on conflict do nothing;

-- ============================================================================
-- TAG BACKFILL — Funk Zone Tier-3 places (Batch 7) + MOXI
-- These 15 rows were seeded without tags and surfaced under no filter. Tags
-- grounded in each row's existing blurb/reason_to_go. Negative rules upheld:
-- none are is_21_plus (family_day allowed where it fits); none are free (no free_sb).
-- ============================================================================
insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('2cc96eca-454f-5254-9b15-893f4ec48267', 'wine_food', 0.70, 'ai'),
  ('2cc96eca-454f-5254-9b15-893f4ec48267', 'family_day', 0.55, 'ai'),
  ('9b55d7dc-27ae-55ba-8e29-7e5a9f3c5552', 'wine_food', 0.75, 'ai'),
  ('9b55d7dc-27ae-55ba-8e29-7e5a9f3c5552', 'date_night', 0.55, 'ai'),
  ('2fe78b23-c2aa-52ab-8255-0188af5fbc78', 'wine_food', 0.70, 'ai'),
  ('2fe78b23-c2aa-52ab-8255-0188af5fbc78', 'family_day', 0.55, 'ai'),
  ('e09431a0-ac20-509c-8af2-653e0735099c', 'wine_food', 0.65, 'ai'),
  ('e09431a0-ac20-509c-8af2-653e0735099c', 'family_day', 0.60, 'ai'),
  ('6e90f0d7-e4c3-53d8-a10c-b4030de9b747', 'wine_food', 0.80, 'ai'),
  ('6e90f0d7-e4c3-53d8-a10c-b4030de9b747', 'date_night', 0.55, 'ai'),
  ('13549c41-575d-5a5e-b05a-e79dd2541a3f', 'wine_food', 0.80, 'ai'),
  ('13549c41-575d-5a5e-b05a-e79dd2541a3f', 'date_night', 0.55, 'ai'),
  ('3bf44b2f-712c-58cc-9889-a182ff7e14f4', 'wine_food', 0.75, 'ai'),
  ('3bf44b2f-712c-58cc-9889-a182ff7e14f4', 'date_night', 0.60, 'ai'),
  ('aa412e49-b210-5c9c-9472-6143dc5206d0', 'wine_food', 0.75, 'ai'),
  ('aa412e49-b210-5c9c-9472-6143dc5206d0', 'date_night', 0.55, 'ai'),
  ('333a4318-808b-5f32-9427-448c016d8447', 'wine_food', 0.65, 'ai'),
  ('333a4318-808b-5f32-9427-448c016d8447', 'family_day', 0.60, 'ai'),
  ('7789d52a-4830-5cdc-9cb8-6ef26afe8787', 'nightlife', 0.75, 'ai'),
  ('7789d52a-4830-5cdc-9cb8-6ef26afe8787', 'date_night', 0.65, 'ai'),
  ('581f1481-3f8a-56c6-ab74-f31f8aab9666', 'date_night', 0.75, 'ai'),
  ('581f1481-3f8a-56c6-ab74-f31f8aab9666', 'wine_food', 0.70, 'ai'),
  ('581f1481-3f8a-56c6-ab74-f31f8aab9666', 'hosting_visitors', 0.55, 'ai'),
  ('d3117c6d-c791-54bb-87c7-556a20b64897', 'date_night', 0.70, 'ai'),
  ('d3117c6d-c791-54bb-87c7-556a20b64897', 'wine_food', 0.70, 'ai'),
  ('d3117c6d-c791-54bb-87c7-556a20b64897', 'hosting_visitors', 0.55, 'ai'),
  ('d7b34405-20b1-54b8-95f3-87ac0eece025', 'family_day', 0.75, 'ai'),
  ('d7b34405-20b1-54b8-95f3-87ac0eece025', 'wine_food', 0.55, 'ai'),
  ('8e309567-4ee0-5324-894c-7b0d8d664724', 'solo', 0.65, 'ai'),
  ('8e309567-4ee0-5324-894c-7b0d8d664724', 'family_day', 0.55, 'ai'),
  ('1a8ebff3-ee4e-529b-ada4-3115be3e2d4f', 'family_day', 0.90, 'ai'),
  ('1a8ebff3-ee4e-529b-ada4-3115be3e2d4f', 'arts_culture', 0.70, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 11 — OUTDOORS & SCENIC  (Tier-3 places)
-- Google-Places-verified beaches, trails, the wharf, gardens, viewpoints.
-- Fills the empty outdoors_active tag + outdoor_activity/scenic_chill categories.
-- All free/null price, none 21+. reason_to_go required (Tier-3). place_id + lat/lng
-- preloaded so the Phase-8 photo resolver works immediately.
-- ============================================================================
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('6df3330e-1327-537c-9d87-9047a30d60d7', 'place', 'needs_review', 'Stearns Wharf', 'California''s oldest working wooden wharf, jutting into the harbor with restaurants, the Sea Center, and sweeping mountain-and-ocean views.', 'outdoors', 3, 'scenic_chill', 'Stroll the historic planks for 360-degree views, touch-pool sea life at the Sea Center, and an easy sunset walk over the water.', 'waterfront', 'waterfront', '217 Stearns Wharf, Santa Barbara, CA 93101', 34.4100096, -119.6859749, NULL, false, false, '{morning,afternoon,evening}', 'ChIJ6cWzPI0T6YARFQ8jztYu2iA', 'placeholder', 'Stearns Wharf Santa Barbara', 'Open 24 hours; drive on for 90 minutes free parking, but it''s easier to park and walk. The Sea Center touch pools are a kid favorite.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('0cdaea28-c2f7-5327-9f64-e5923a92c88c', 'place', 'needs_review', 'Santa Barbara Botanic Garden', 'Seventy-eight acres of California native plants — redwoods, meadows, and a creek — climbing the foothills above Mission Canyon with ocean views.', 'outdoors', 3, 'culture_spot', 'Wander shaded native-plant trails past a stone-bridged waterfall and a redwood grove, with sweeping views from the top.', 'mission_canyon', NULL, '1212 Mission Canyon Rd, Santa Barbara, CA 93105', 34.4565481, -119.7100254, NULL, false, false, '{morning,afternoon}', 'ChIJ8_QiI7AU6YAR46fpO-RTDNk', 'placeholder', 'Santa Barbara Botanic Garden Mission Canyon', 'Open 10–5 daily; gentle slopes with some stairs. A gift shop and native-plant nursery on site. Admission charged at the gate.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('2bfd85e8-d784-5763-b2e1-9aadba33b852', 'place', 'needs_review', 'Douglas Family Preserve', 'A 70-acre blufftop preserve above Arroyo Burro Beach, with mostly off-leash trails through cypress and grassland to dramatic ocean overlooks.', 'outdoors', 3, 'outdoor_activity', 'Walk the cliff-edge loop at sunset with the dogs off-leash and the Pacific spread out below.', 'mesa', 'mesa', 'Linda Rd & Selrose Ln, Santa Barbara, CA 93109', 34.4027055, -119.7388456, NULL, false, false, '{morning,afternoon,evening}', 'ChIJ0S20FEkU6YARI1CV4rPjPbA', 'placeholder', 'Douglas Family Preserve Santa Barbara', 'Park at the neighborhood trailhead (Linda/Selrose); the highway-side entrance has no parking. Largely off-leash for dogs.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('0ac524b3-3a48-59a7-bd04-7fd0c9ba4c04', 'place', 'needs_review', 'Shoreline Park', 'A long grassy clifftop park on the Mesa with a paved oceanfront path, a playground, picnic tables, and steps down to the beach.', 'outdoors', 3, 'scenic_chill', 'Picnic on the bluff with whale-watching views, let the kids loose on the playground, or take the stairs to the sand at golden hour.', 'mesa', 'mesa', 'Shoreline Dr & Santa Rosa Pl, Santa Barbara, CA 93109', 34.3964348, -119.7067671, NULL, false, false, '{morning,afternoon,evening}', 'ChIJM7enOw4U6YARTgWaaw8a8PQ', 'placeholder', 'Shoreline Park Santa Barbara Mesa', 'Open 7am–7pm; clean restrooms, ample parking (busy in summer). A steep stairway leads to a dog-friendly stretch of beach.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('9d4f8832-751f-5f36-a351-4eef8b0ed68e', 'place', 'needs_review', 'Butterfly Beach', 'A quiet, west-facing Montecito beach below the Biltmore, beloved for sunset views and celebrity-adjacent people-watching.', 'outdoors', 3, 'scenic_chill', 'Catch one of the area''s best sunsets from the sand, with free street parking and the Biltmore as a backdrop.', 'montecito', 'montecito', 'Channel Dr, Montecito, CA 93108', 34.4176221, -119.6491956, NULL, false, false, '{afternoon,evening}', 'ChIJowaCt8oT6YAR1fj5iR0pJxs', 'placeholder', 'Butterfly Beach Montecito', 'Free street parking along Channel Dr. Heads up: occasional natural tar on the sand can stain feet and sandals.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('7f0d2cde-c10b-555e-94fb-d758c2f49320', 'place', 'needs_review', 'Leadbetter Beach', 'A sheltered, family-friendly beach beside the harbor with calm water, picnic tables, fire pits, and tide pools — a local favorite for beginners.', 'outdoors', 3, 'outdoor_activity', 'Learn to surf or kayak in gentle waves, grill at a fire pit, then walk the path up to Shoreline Park.', 'mesa', 'mesa', '801 Shoreline Dr, Santa Barbara, CA 93109', 34.4021592, -119.6983057, NULL, false, false, '{morning,afternoon,evening}', 'ChIJJ5SxSwoU6YAR_CtGw69EBHg', 'placeholder', 'Leadbetter Beach Santa Barbara', 'Pay parking lot right at the sand; first-come picnic tables and fire pits. Calm, shallow water makes it great for kids and beginners.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('b3620003-511f-5eaf-a0a6-7151d1f24b31', 'place', 'needs_review', 'Inspiration Point', 'A classic ~3.8-mile out-and-back from Tunnel Road, climbing past a shaded creek to a ridge with sweeping views of the city, ocean, and Channel Islands.', 'outdoors', 3, 'outdoor_activity', 'Hike the quintessential SB trail — paved start, single-track creek crossings, then a sudden 200-degree summit view.', 'mission_canyon', NULL, 'Tunnel Rd, Santa Barbara, CA 93105', 34.4650224, -119.7125361, NULL, false, false, '{morning,afternoon}', 'ChIJY6wGjExr6YARbsVXGSQDu_U', 'placeholder', 'Inspiration Point trail Santa Barbara', 'Park along Tunnel Rd and go early — limited parking, popular trail. Stay left at every fork for the point; creek runs in winter.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('fad67f60-5854-517b-a38b-0d7d55200214', 'place', 'needs_review', 'Arroyo Burro Beach (Hendry''s)', 'The Mesa''s beloved county beach — locals call it Hendry''s — with driftwood, tide pools, a dog-friendly stretch, and a self-serve dog wash.', 'outdoors', 3, 'scenic_chill', 'Walk the wide sandy beach, let the dog off-leash on the west end, and climb the bluff stairs for the overlook.', 'mesa', 'mesa', '2981 Cliff Dr, Santa Barbara, CA 93109', 34.4028444, -119.7432062, NULL, false, false, '{morning,afternoon,evening}', 'ChIJbZsC90wU6YARjtZASm1HAO0', 'placeholder', 'Arroyo Burro Beach Hendrys Santa Barbara', 'Free parking (tight in summer); restrooms, showers, and a self-service dog wash. The west end is the off-leash dog stretch.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('eb6ef47a-4a9b-5113-8844-ff1613b9ddf0', 'place', 'needs_review', 'East Beach', 'A long, clean sweep of sand east of the wharf with volleyball courts, a bike path, and lifeguards — calmer than the harbor side.', 'outdoors', 3, 'scenic_chill', 'Play beach volleyball, bike the waterfront path, or just stretch out on the wide, well-kept sand.', 'waterfront', 'waterfront', 'E Cabrillo Blvd, Santa Barbara, CA 93101', 34.415256, -119.6763529, NULL, false, false, '{morning,afternoon,evening}', 'ChIJGzMM5L4T6YARn_FDQyEUZS8', 'placeholder', 'East Beach Santa Barbara', 'Volleyball courts and lifeguard stations along the sand; metered beach lots nearby. The zoo and bird refuge are a few blocks east.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('06f4fe67-41e1-5472-933d-d972331c51eb', 'place', 'needs_review', 'Lizard''s Mouth', 'A sandstone playground high on West Camino Cielo, full of caves, boulders, and grippy rock formations with panoramic views over Goleta and the islands.', 'outdoors', 3, 'outdoor_activity', 'Scramble and boulder among surreal rock formations, then watch the sunset over the Channel from the ridge.', 'other', NULL, 'W Camino Cielo, Santa Barbara, CA 93105', 34.5022337, -119.8679437, NULL, false, false, '{afternoon,evening}', 'ChIJAQAAAAB06YAR9IF_EKtDDmQ', 'placeholder', 'Lizards Mouth Rock Santa Barbara', 'Trailhead is hard to spot from the road — keep driving up West Camino Cielo and watch for roadside pullouts on the left. Up Hwy 154, ~30 min from downtown.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('3289085c-e1c2-50c0-9319-55d0a89fff2b', 'place', 'needs_review', 'Chumash Painted Cave State Historic Park', 'A small sandstone cave on Painted Cave Road preserving vivid Chumash rock art — colorful pictographs viewable through a protective grate.', 'outdoors', 3, 'culture_spot', 'See centuries-old Chumash pictographs up close in a quiet foothill setting, paired with a scenic drive up Hwy 154.', 'other', NULL, 'Painted Cave Rd, Santa Barbara, CA 93105', 34.5041853, -119.7876117, NULL, false, false, '{morning,afternoon}', 'ChIJ72norgpq6YARNjc9w8RhqB4', 'placeholder', 'Chumash Painted Cave Santa Barbara', 'The access road is narrow and steep with parking for only 2–3 cars; the cave is a short rock-stair climb. View through the grate — entry not permitted.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('326932ff-3d27-5607-9db3-72589187af1b', 'place', 'needs_review', 'Elings Park', 'A 230-acre privately funded park above the Mesa with hiking and mountain-bike trails, sports fields, disc golf, and hang-gliding launches.', 'outdoors', 3, 'outdoor_activity', 'Hike or bike the hilltop trails for Channel Islands views, then catch hang-gliders launching off the ridge.', 'mesa', 'mesa', '1298 Las Positas Rd, Santa Barbara, CA 93105', 34.411447, -119.7359092, NULL, false, false, '{morning,afternoon}', 'ChIJ35K4TVEU6YARf3-Dc-VDh5I', 'placeholder', 'Elings Park Santa Barbara', 'Weekend entry may carry a cash fee. Trails range easy to challenging; also home to summer events on the outdoor stage.', '2026-06-24'::timestamptz, 'seed:google_places')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('6df3330e-1327-537c-9d87-9047a30d60d7', 'hosting_visitors', 0.85, 'ai'),
  ('6df3330e-1327-537c-9d87-9047a30d60d7', 'family_day', 0.75, 'ai'),
  ('6df3330e-1327-537c-9d87-9047a30d60d7', 'outdoors_active', 0.55, 'ai'),
  ('0cdaea28-c2f7-5327-9f64-e5923a92c88c', 'outdoors_active', 0.80, 'ai'),
  ('0cdaea28-c2f7-5327-9f64-e5923a92c88c', 'arts_culture', 0.65, 'ai'),
  ('0cdaea28-c2f7-5327-9f64-e5923a92c88c', 'family_day', 0.60, 'ai'),
  ('2bfd85e8-d784-5763-b2e1-9aadba33b852', 'outdoors_active', 0.90, 'ai'),
  ('2bfd85e8-d784-5763-b2e1-9aadba33b852', 'solo', 0.60, 'ai'),
  ('2bfd85e8-d784-5763-b2e1-9aadba33b852', 'family_day', 0.55, 'ai'),
  ('0ac524b3-3a48-59a7-bd04-7fd0c9ba4c04', 'outdoors_active', 0.75, 'ai'),
  ('0ac524b3-3a48-59a7-bd04-7fd0c9ba4c04', 'family_day', 0.75, 'ai'),
  ('0ac524b3-3a48-59a7-bd04-7fd0c9ba4c04', 'date_night', 0.50, 'ai'),
  ('9d4f8832-751f-5f36-a351-4eef8b0ed68e', 'date_night', 0.70, 'ai'),
  ('9d4f8832-751f-5f36-a351-4eef8b0ed68e', 'outdoors_active', 0.60, 'ai'),
  ('9d4f8832-751f-5f36-a351-4eef8b0ed68e', 'solo', 0.50, 'ai'),
  ('7f0d2cde-c10b-555e-94fb-d758c2f49320', 'family_day', 0.85, 'ai'),
  ('7f0d2cde-c10b-555e-94fb-d758c2f49320', 'outdoors_active', 0.80, 'ai'),
  ('7f0d2cde-c10b-555e-94fb-d758c2f49320', 'hosting_visitors', 0.55, 'ai'),
  ('b3620003-511f-5eaf-a0a6-7151d1f24b31', 'outdoors_active', 0.95, 'ai'),
  ('b3620003-511f-5eaf-a0a6-7151d1f24b31', 'solo', 0.60, 'ai'),
  ('fad67f60-5854-517b-a38b-0d7d55200214', 'outdoors_active', 0.75, 'ai'),
  ('fad67f60-5854-517b-a38b-0d7d55200214', 'family_day', 0.70, 'ai'),
  ('fad67f60-5854-517b-a38b-0d7d55200214', 'solo', 0.50, 'ai'),
  ('eb6ef47a-4a9b-5113-8844-ff1613b9ddf0', 'outdoors_active', 0.70, 'ai'),
  ('eb6ef47a-4a9b-5113-8844-ff1613b9ddf0', 'family_day', 0.70, 'ai'),
  ('eb6ef47a-4a9b-5113-8844-ff1613b9ddf0', 'hosting_visitors', 0.50, 'ai'),
  ('06f4fe67-41e1-5472-933d-d972331c51eb', 'outdoors_active', 0.90, 'ai'),
  ('06f4fe67-41e1-5472-933d-d972331c51eb', 'solo', 0.55, 'ai'),
  ('3289085c-e1c2-50c0-9319-55d0a89fff2b', 'arts_culture', 0.70, 'ai'),
  ('3289085c-e1c2-50c0-9319-55d0a89fff2b', 'outdoors_active', 0.55, 'ai'),
  ('326932ff-3d27-5607-9db3-72589187af1b', 'outdoors_active', 0.90, 'ai'),
  ('326932ff-3d27-5607-9db3-72589187af1b', 'family_day', 0.60, 'ai'),
  ('326932ff-3d27-5607-9db3-72589187af1b', 'solo', 0.50, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 12 — RECURRING RHYTHMS Pt.1: Nightlife & Weekly Specials (Tier-2)
-- Attacks the emptiest tier. Start-time strictness applies to recurring rows too:
-- a sourced day-of-week + clock time, else the time is left NULL and flagged
-- (never invented). Two of three anchors attach schedules to EXISTING place rows
-- (the Tier-2 overlay pattern); one new venue (SB Biergarten) gets a base row.
--   • SB Biergarten Trivia — Wed 6-7pm, free        [Visit SB, authoritative]  NEW row
--   • Lure Fish House Happy Hour — Mon-Fri 3-6pm + Sun 11:30-5  [multi-source]  overlay
--   • Validation Ale Live Music — Thursdays (time not published) [Independent]  overlay
-- ============================================================================

-- New base venue: SB Biergarten (Downtown) --------------------------------
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('e9b2b6b8-52b1-5c9d-acb9-c09f654d28c9', 'place', 'needs_review', 'SB Biergarten', 'An easygoing downtown beer garden at 11 Anacapa with a big patio, rotating taps, and weekly community nights.', 'drink', 2, 'recurring_nightlife', 'Drop in for Wednesday trivia (6-7pm, free, for a good cause) with good food and good drinks on the patio.', 'downtown', 'downtown', '11 Anacapa Street, Santa Barbara, CA 93101', 34.4132103, -119.6883026, NULL, false, false, '{evening}', NULL, 'placeholder', 'SB Biergarten Santa Barbara', 'Weekly trivia hosted by Boone Graphics benefits Central Coast nonprofits. Family-friendly early evening.', '2026-06-24'::timestamptz, 'https://santabarbaraca.com/events/trivia-night/')
on conflict (id) do nothing;

-- Recurring schedules -----------------------------------------------------
-- SB Biergarten: Wednesday trivia 6-7pm
insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
  ('e9b2b6b8-52b1-5c9d-acb9-c09f654d28c9', 'recurring_nightlife', 3, '18:00', '19:00', 'Wednesday Trivia Night', '2026-06-24')
on conflict (thing_id, day_of_week, category) do nothing;

-- Lure Fish House (existing row 95da582e...): Happy Hour Mon-Fri 3-6pm + Sun 11:30am-5pm
insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'weekly_special', 1, '15:00', '18:00', 'Happy Hour', '2026-06-24'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'weekly_special', 2, '15:00', '18:00', 'Happy Hour', '2026-06-24'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'weekly_special', 3, '15:00', '18:00', 'Happy Hour', '2026-06-24'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'weekly_special', 4, '15:00', '18:00', 'Happy Hour', '2026-06-24'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'weekly_special', 5, '15:00', '18:00', 'Happy Hour', '2026-06-24'),
  ('95da582e-74f2-50d3-8715-cfe340b80848', 'weekly_special', 0, '11:30', '17:00', 'Sunday Happy Hour', '2026-06-24')
on conflict (thing_id, day_of_week, category) do nothing;

-- Validation Ale (existing row e09431a0...): Live music every Thursday (time not published -> NULL, flagged)
insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
  ('e09431a0-ac20-509c-8af2-653e0735099c', 'recurring_nightlife', 4, NULL, NULL, 'Thursday Live Music (time TBD)', '2026-06-24')
on conflict (thing_id, day_of_week, category) do nothing;

-- Tags for the new SB Biergarten row only (existing rows keep their Batch-7/10 tags)
insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('e9b2b6b8-52b1-5c9d-acb9-c09f654d28c9', 'nightlife', 0.75, 'ai'),
  ('e9b2b6b8-52b1-5c9d-acb9-c09f654d28c9', 'free_sb', 0.70, 'ai'),
  ('e9b2b6b8-52b1-5c9d-acb9-c09f654d28c9', 'family_day', 0.55, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 13 — SPORTS & ACTIVE EVENTS (Tier-1) + one Tier-2 outdoor rhythm
-- Fills the empty Tier-1 sports_outdoors_event category with DATED, in-window,
-- concretely-timed active events. Bonus: Nite Moves is a true weekly rhythm, so
-- it's modeled Tier-2 recurring_outdoors (filling an empty Tier-2 category early).
-- Polo admission is complimentary on the 12-goal Sundays per Visit SB; the two
-- in-window Skene Trophy dates are 16-goal (ticketed) -> price left null (not on
-- the sourced page). Goleta Beach Half also deepens Goleta coverage.
-- ============================================================================
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url, photo_source, photo_query, local_note, last_confirmed, source) values
  ('a9680140-e84b-5eae-85b7-9404f780b19c', 'event', 'needs_review', 'Sunday Polo: Robert Skene Trophy (July 12)', 'High-goal Sunday polo at the historic Carpinteria club — the Robert Skene Trophy opens the 16-goal series, set between the foothills and the sea.', 'outdoors', 1, 'sports_outdoors_event', 'carpinteria', NULL, 'Santa Barbara Polo & Racquet Club, 3375 Foothill Rd, Carpinteria, CA 93013', NULL, false, false, '{afternoon}', '2026-07-12T15:30:00-07:00'::timestamptz, '2026-07-12T17:30:00-07:00'::timestamptz, 'https://sbpolo.ticketsauce.com/', 'placeholder', 'Santa Barbara Polo Racquet Club Carpinteria', 'Gates well before the 3:30 throw-in; bring a hat, mind the dress code, and stay for the divot stomp at halftime. Tickets via the club.', '2026-06-24'::timestamptz, 'https://sbpolo.ticketsauce.com/'),
  ('909895f4-c521-5fc2-87dc-a790f8116de3', 'event', 'needs_review', 'Sunday Polo: Robert Skene Trophy (July 19)', 'Week two of the Robert Skene Trophy — another Sunday afternoon of 16-goal polo at the Santa Barbara Polo & Racquet Club in Carpinteria.', 'outdoors', 1, 'sports_outdoors_event', 'carpinteria', NULL, 'Santa Barbara Polo & Racquet Club, 3375 Foothill Rd, Carpinteria, CA 93013', NULL, false, false, '{afternoon}', '2026-07-19T15:30:00-07:00'::timestamptz, '2026-07-19T17:30:00-07:00'::timestamptz, 'https://sbpolo.ticketsauce.com/', 'placeholder', 'Santa Barbara Polo Racquet Club Carpinteria', 'Throw-in at 3:30; tailgates, terrace tables, and cabanas available. About 12 miles down the 101 from downtown.', '2026-06-24'::timestamptz, 'https://sbpolo.ticketsauce.com/'),
  ('189159e0-1267-51e2-af6a-ac72ec44c000', 'event', 'needs_review', 'Semana Nautica 5K & 2K Trail Run', 'A scenic Fourth-of-July trail run through Elings Park, part of Santa Barbara''s long-running Semana Nautica sports festival, with a kids 2K too.', 'outdoors', 1, 'sports_outdoors_event', 'mesa', 'mesa', 'Elings Park, 1298 Las Positas Rd, Santa Barbara, CA 93105', '$$', false, false, '{morning}', '2026-07-04T08:30:00-07:00'::timestamptz, NULL, 'https://runsignup.com/Race/Register/?raceId=185393', 'placeholder', 'Elings Park Santa Barbara trail run', '5K starts 8:30am, kids/adult 2K at 9:30am, on Elings Park''s hilltop trails. Benefits the Santa Barbara Running Association.', '2026-06-24'::timestamptz, 'https://runsignup.com/Race/CA/SantaBarbara/SemanaNautica5KKids2K'),
  ('2b0c22a8-fb9b-5045-be55-5724e1ed01fb', 'event', 'needs_review', 'Goleta Beach Half Marathon, 10K & 5K', 'A flat, fast morning race along the Goleta coast — half marathon, 10K, 5K, and a kids run — starting and finishing at Goleta Beach Park.', 'outdoors', 1, 'sports_outdoors_event', 'goleta', 'goleta', 'Goleta Beach County Park, 5990 Sandspit Rd, Goleta, CA 93117', NULL, false, false, '{morning}', '2026-06-27T08:00:00-07:00'::timestamptz, NULL, NULL, 'placeholder', 'Goleta Beach County Park race', 'An 8am start at Goleta Beach with ocean views the whole way; multiple distances plus a kids run. Confirm exact wave times on the race site.', '2026-06-24'::timestamptz, 'https://runningintheusa.com/race/list/santa%20barbara-county-ca/upcoming'),
  ('e0d29d33-6a46-582a-b8e6-c9a2a96b0d87', 'event', 'needs_review', 'Nite Moves: Summer Sunset Series', 'Santa Barbara''s twilight tradition — a Wednesday-evening 5K run, ocean swim, or full aquathon at Leadbetter Beach, capped by a beer garden and live music.', 'outdoors', 2, 'recurring_outdoors', 'mesa', 'mesa', 'Leadbetter Beach Park, 801 Shoreline Dr, Santa Barbara, CA 93101', '$$', false, false, '{evening}', NULL, NULL, 'https://www.active.com/santa-barbara-ca/running/distance-running-races/nite-moves-2026', 'placeholder', 'Nite Moves Leadbetter Beach Santa Barbara', 'Every Wednesday May–August. Onsite registration 5:15pm; swim 6:25pm, run 6:35pm. Beer garden, live music, kids'' sand sprint, McConnell''s ice cream.', '2026-06-24'::timestamptz, 'https://www.runsantabarbara.com/nite-moves/')
on conflict (id) do nothing;

-- Nite Moves Wednesday rhythm (run start 6:35pm)
insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
  ('e0d29d33-6a46-582a-b8e6-c9a2a96b0d87', 'recurring_outdoors', 3, '18:35', '20:00', 'Wednesday Nite Moves (run 6:35pm, swim 6:25pm)', '2026-06-24')
on conflict (thing_id, day_of_week, category) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('a9680140-e84b-5eae-85b7-9404f780b19c', 'outdoors_active', 0.70, 'ai'),
  ('a9680140-e84b-5eae-85b7-9404f780b19c', 'hosting_visitors', 0.70, 'ai'),
  ('a9680140-e84b-5eae-85b7-9404f780b19c', 'date_night', 0.50, 'ai'),
  ('909895f4-c521-5fc2-87dc-a790f8116de3', 'outdoors_active', 0.70, 'ai'),
  ('909895f4-c521-5fc2-87dc-a790f8116de3', 'hosting_visitors', 0.70, 'ai'),
  ('909895f4-c521-5fc2-87dc-a790f8116de3', 'date_night', 0.50, 'ai'),
  ('189159e0-1267-51e2-af6a-ac72ec44c000', 'outdoors_active', 0.90, 'ai'),
  ('189159e0-1267-51e2-af6a-ac72ec44c000', 'family_day', 0.65, 'ai'),
  ('189159e0-1267-51e2-af6a-ac72ec44c000', 'solo', 0.50, 'ai'),
  ('2b0c22a8-fb9b-5045-be55-5724e1ed01fb', 'outdoors_active', 0.90, 'ai'),
  ('2b0c22a8-fb9b-5045-be55-5724e1ed01fb', 'family_day', 0.60, 'ai'),
  ('2b0c22a8-fb9b-5045-be55-5724e1ed01fb', 'solo', 0.50, 'ai'),
  ('e0d29d33-6a46-582a-b8e6-c9a2a96b0d87', 'outdoors_active', 0.90, 'ai'),
  ('e0d29d33-6a46-582a-b8e6-c9a2a96b0d87', 'family_day', 0.60, 'ai'),
  ('e0d29d33-6a46-582a-b8e6-c9a2a96b0d87', 'nightlife', 0.45, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 14 — GOLETA DEEP-DIVE (all tiers)
-- Goleta sat at 2 rows despite being a real population center. Adds:
--   • 1 scenic Tier-3 (Goleta Beach Park) + 4 brewery/cafe/restaurant Tier-3
--   • 1 culture Tier-3 (The Stow House, historic landmark)
--   • 1 Tier-2 recurring market (Camino Real Sunday market, authoritative Visit SB)
-- Google-Places-verified; place_id + lat/lng preloaded. All none-21+; price from
-- Google price_level where present, else null (not guessed).
-- ============================================================================

-- Tier-2 recurring market (base row + schedule) ---------------------------
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, photo_source, photo_query, local_note, last_confirmed, source) values
  ('72003f9f-bedc-5ae4-bacc-f3d938731280', 'event', 'needs_review', 'Camino Real Marketplace Farmers'' Market', 'Goleta''s Sunday-morning certified farmers market at the Camino Real Marketplace — local produce, flowers, and prepared foods, with easy parking.', 'food', 2, 'recurring_market', 'Shop a relaxed Sunday market for Goleta-grown produce and treats, with the Marketplace''s shops and food right there.', 'goleta', 'goleta', '7004 Marketplace Dr, Goleta, CA 93117', 'free', false, false, '{morning,afternoon}', 'placeholder', 'Camino Real Marketplace farmers market Goleta', 'Year-round Sundays, 10am–2pm. Two hours free underground parking at the Marketplace. Accepts CalFresh EBT, WIC, and cards.', '2026-06-24'::timestamptz, 'https://santabarbaraca.com/plan-your-trip/food-drink/farm-stands-and-u-pick/')
on conflict (id) do nothing;

insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
  ('72003f9f-bedc-5ae4-bacc-f3d938731280', 'recurring_market', 0, '10:00', '14:00', 'Sunday Goleta Market', '2026-06-24')
on conflict (thing_id, day_of_week, category) do nothing;

-- Tier-3 places -----------------------------------------------------------
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('79687bf9-2bf9-56ba-9192-5fe8408d8177', 'place', 'needs_review', 'Goleta Beach Park', 'A calm, family-friendly county beach with a long fishing pier, grassy picnic lawns, and mountain-and-ocean views — quieter than the city beaches.', 'outdoors', 3, 'scenic_chill', 'Walk the pier at sunrise, picnic on the lawn, or watch pelicans dive — an easy, uncrowded beach day near UCSB.', 'goleta', 'goleta', '5986 Sandspit Rd, Goleta, CA 93117', 34.4168342, -119.8322099, NULL, false, false, '{morning,afternoon,evening}', 'ChIJadY1UJk_6YARZb7MCoYjIXw', 'placeholder', 'Goleta Beach Park pier', 'Lots of parking; grassy picnic areas and a long pier. A short walk from UCSB and the Obern bike path.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('0f7839e5-407b-5591-8429-85c14bb876ef', 'place', 'needs_review', 'Draughtsmen Aleworks', 'A down-to-earth Goleta brewery with excellent draft and non-alcoholic options, a heated patio, food trucks, and a packed weekly events calendar.', 'drink', 3, 'food_drink_spot', 'Try a flight from a wholesome local brewer, with Thai from the food truck and trivia, bingo, or yoga depending on the night.', 'goleta', 'goleta', '53 Santa Felicia Dr, Goleta, CA 93117', 34.4322223, -119.8760899, NULL, false, false, '{afternoon,evening}', 'ChIJsWzl1LNA6YARubWuCtQXWzs', 'placeholder', 'Draughtsmen Aleworks Goleta', 'Dog-friendly with a heated patio and rotating food trucks. Weekly events incl. trivia (Tuesdays) and a Sunday cyclists group ride — confirm times.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('6f1d666d-a69d-5985-ae86-b34a0050f234', 'place', 'needs_review', 'M Special Brewing Company', 'A lively Goleta taproom with a big indoor-outdoor space, cornhole, food trucks, and a wide range of house brews.', 'drink', 3, 'food_drink_spot', 'Grab a flight and a patio table with friends, with cornhole and a food truck on hand.', 'goleta', 'goleta', '6860 Cortona Dr Building C, Goleta, CA 93117', 34.432784, -119.868536, NULL, false, false, '{afternoon,evening}', 'ChIJ25e4v7pA6YARnROZU3zkYQI', 'placeholder', 'M Special Brewing Goleta', 'Plenty of indoor and outdoor seating; dog-friendly with ample parking. Dine-in beer orders may require a food order.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('e5058de7-19ee-5800-9918-8cd70ff24977', 'place', 'needs_review', 'Captain Fatty''s Brewery', 'A warm, family-run Goleta brewery with standout beers, weekend wood-fired pizza, arcade games, and frequent live music.', 'drink', 3, 'food_drink_spot', 'Pair a flight with Santa Barbara Woodfire pizza on weekends, with games and live music for an easy evening out.', 'goleta', 'goleta', '6489 Calle Real Ste D, Goleta, CA 93117', 34.4393265, -119.8523254, NULL, false, false, '{afternoon,evening}', 'ChIJfbE3OZFA6YARwiZR_mshK-I', 'placeholder', 'Captain Fattys Brewery Goleta', 'Family- and dog-friendly with arcade games; wood-fired pizza Friday–Sunday and frequent live bands.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('a9f1743e-83cd-58d5-93b4-d44bf6cbca15', 'place', 'needs_review', 'Old Town Coffee', 'A characterful Old Town Goleta coffee shop with indoor and patio seating, an arcade corner, sandwiches, and vegan options.', 'food', 3, 'culture_spot', 'Settle in with a coconut latte and a fresh bagel — a roomy, outlet-friendly spot to work or linger in Old Town.', 'goleta', 'goleta', '5877 Hollister Ave, Goleta, CA 93117', 34.4358225, -119.8284261, '$', true, false, '{morning,afternoon}', 'ChIJndXTVOJB6YARqOQlEOsTdzw', 'placeholder', 'Old Town Coffee Goleta Hollister', 'Lots of space, power outlets, and a patio; popular with UCSB students and remote workers. Limited street parking.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('c589e83b-d520-5273-b776-c315a42888dd', 'place', 'needs_review', 'Los Altos Restaurant', 'A colorful, welcoming Old Town Goleta Mexican spot with homemade tortillas, a self-serve salsa bar, and generous plates.', 'food', 3, 'food_drink_spot', 'Dig into homemade tortillas and barbacoa tacos with nine self-serve salsas, plus a solid weekday happy hour.', 'goleta', 'goleta', '5892 Hollister Ave, Goleta, CA 93117', 34.4361727, -119.8289096, '$$', true, false, '{afternoon,evening}', 'ChIJfbssMmdB6YAR7oF1Sw376ug', 'placeholder', 'Los Altos Restaurant Goleta', 'High ceilings, free parking in back, and a self-serve salsa bar. Reviewers cite a weekday happy hour — confirm exact hours before publish.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('a6296a75-daab-5cad-9fbe-f4e584aca4e1', 'place', 'needs_review', 'The Stow House', 'An 1872 Victorian farmhouse on a leafy Goleta estate, with period rooms, an arboretum, and the railroad depot museum next door.', 'culture', 3, 'culture_spot', 'Step into 1870s Goleta on a weekend tour of the historic house and grounds — kid-friendly, with seasonal festivals.', 'goleta', 'goleta', '304 N Los Carneros Rd, Goleta, CA 93117', 34.4429803, -119.8516908, NULL, true, false, '{afternoon}', 'ChIJI5p1m5NA6YARUWjipzxs3CY', 'placeholder', 'Stow House Goleta historic', 'Open Sat 1–4pm and Sun 11am–4pm; contact ahead to confirm tours. Next to the Goleta Depot railroad museum and Lake Los Carneros trails.', '2026-06-24'::timestamptz, 'seed:google_places')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('72003f9f-bedc-5ae4-bacc-f3d938731280', 'free_sb', 0.85, 'ai'),
  ('72003f9f-bedc-5ae4-bacc-f3d938731280', 'family_day', 0.70, 'ai'),
  ('72003f9f-bedc-5ae4-bacc-f3d938731280', 'wine_food', 0.55, 'ai'),
  ('79687bf9-2bf9-56ba-9192-5fe8408d8177', 'outdoors_active', 0.75, 'ai'),
  ('79687bf9-2bf9-56ba-9192-5fe8408d8177', 'family_day', 0.75, 'ai'),
  ('79687bf9-2bf9-56ba-9192-5fe8408d8177', 'solo', 0.50, 'ai'),
  ('0f7839e5-407b-5591-8429-85c14bb876ef', 'wine_food', 0.65, 'ai'),
  ('0f7839e5-407b-5591-8429-85c14bb876ef', 'family_day', 0.55, 'ai'),
  ('0f7839e5-407b-5591-8429-85c14bb876ef', 'nightlife', 0.50, 'ai'),
  ('6f1d666d-a69d-5985-ae86-b34a0050f234', 'wine_food', 0.65, 'ai'),
  ('6f1d666d-a69d-5985-ae86-b34a0050f234', 'family_day', 0.55, 'ai'),
  ('e5058de7-19ee-5800-9918-8cd70ff24977', 'wine_food', 0.65, 'ai'),
  ('e5058de7-19ee-5800-9918-8cd70ff24977', 'family_day', 0.65, 'ai'),
  ('e5058de7-19ee-5800-9918-8cd70ff24977', 'nightlife', 0.45, 'ai'),
  ('a9f1743e-83cd-58d5-93b4-d44bf6cbca15', 'solo', 0.70, 'ai'),
  ('a9f1743e-83cd-58d5-93b4-d44bf6cbca15', 'family_day', 0.50, 'ai'),
  ('c589e83b-d520-5273-b776-c315a42888dd', 'wine_food', 0.60, 'ai'),
  ('c589e83b-d520-5273-b776-c315a42888dd', 'family_day', 0.55, 'ai'),
  ('a6296a75-daab-5cad-9fbe-f4e584aca4e1', 'arts_culture', 0.75, 'ai'),
  ('a6296a75-daab-5cad-9fbe-f4e584aca4e1', 'family_day', 0.65, 'ai'),
  ('a6296a75-daab-5cad-9fbe-f4e584aca4e1', 'outdoors_active', 0.45, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 15 — RECURRING RHYTHMS Pt.2: Arts (Tier-2)  — fills the LAST empty
-- Tier-2 category (recurring_arts). Two authoritative, free, all-ages art walks.
-- SCHEDULE-MODEL NOTE: recurring_schedules keys on day_of_week (0-6), which models
-- WEEKLY rhythms. Both of these are SUB-weekly (monthly / bi-monthly), so the
-- schedule row stores the correct weekday + a label/last_confirmed that state the
-- true cadence; the monthly/bi-monthly nuance is also in local_note. This is the
-- honest fit within the current schema (no weekly time is invented).
--   • 1st Thursday Art Walk — Downtown, 1st Thursday/month, 5-8pm  [City of SB]
--   • Funk Zone Art Walk — Funk Zone, bi-monthly Fridays, 5-8pm    [funkzone.net + press]
-- The Funk Zone row is also the Zone's first non-place (Tier-2) row.
-- ============================================================================
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, price_band, indoor, is_21_plus, time_of_day_fit, photo_source, photo_query, local_note, last_confirmed, source) values
  ('29d8129b-a514-56aa-8028-5ddac4d620da', 'event', 'needs_review', '1st Thursday Art Walk', 'A free, City-sponsored evening of art and culture downtown — galleries, museums, and venues open their doors for openings, live music, receptions, and hands-on activities.', 'arts', 2, 'recurring_arts', 'Gallery-hop downtown on the first Thursday of the month — free art openings, live music, and wine, all in one walkable evening.', 'downtown', 'downtown', 'Downtown State Street corridor, Santa Barbara, CA 93101', 'free', false, false, '{evening}', 'placeholder', 'Santa Barbara 1st Thursday art walk downtown', 'First Thursday of EACH MONTH, 5–8pm (monthly cadence; schedule row uses Thursday as the weekday anchor). Free, all ages; participating galleries and venues across downtown.', '2026-06-24'::timestamptz, 'https://calendar.santabarbaraca.gov/1st-thursday-art-walk'),
  ('5fc68c7d-91ad-5014-893d-d7d2aab22116', 'event', 'needs_review', 'Funk Zone Art Walk', 'The Funk Zone''s recurring art walk — studios, galleries, and art-centric venues open from 5–8pm with exhibition openings, artist receptions, pop-up booths, live music, and tastings.', 'arts', 2, 'recurring_arts', 'Wander the Funk Zone''s studios and galleries on a Friday-evening art walk, with pop-up artists, live music, and wine throughout the Zone.', 'funk_zone', 'funk', 'Funk Zone (Anacapa & Yanonali Streets area), Santa Barbara, CA 93101', 'free', false, false, '{evening}', 'placeholder', 'Funk Zone Art Walk Santa Barbara', 'Bi-monthly (~every 8 weeks) on a FRIDAY evening, 5–8pm — NOT weekly; confirm the specific date on funkzone.net before publishing. Free, all ages. Often paired with food trucks and live musicians.', '2026-06-24'::timestamptz, 'https://www.funkzone.net/')
on conflict (id) do nothing;

insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
  ('29d8129b-a514-56aa-8028-5ddac4d620da', 'recurring_arts', 4, '17:00', '20:00', '1st Thursday of each month (monthly)', '2026-06-24'),
  ('5fc68c7d-91ad-5014-893d-d7d2aab22116', 'recurring_arts', 5, '17:00', '20:00', 'Bi-monthly Friday (~every 8 weeks)', '2026-06-24')
on conflict (thing_id, day_of_week, category) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('29d8129b-a514-56aa-8028-5ddac4d620da', 'arts_culture', 0.95, 'ai'),
  ('29d8129b-a514-56aa-8028-5ddac4d620da', 'free_sb', 0.90, 'ai'),
  ('29d8129b-a514-56aa-8028-5ddac4d620da', 'date_night', 0.60, 'ai'),
  ('5fc68c7d-91ad-5014-893d-d7d2aab22116', 'arts_culture', 0.95, 'ai'),
  ('5fc68c7d-91ad-5014-893d-d7d2aab22116', 'free_sb', 0.90, 'ai'),
  ('5fc68c7d-91ad-5014-893d-d7d2aab22116', 'date_night', 0.60, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 16 — SHOPPING & BROWSE + CULTURE (Tier-3)  — fills the LAST empty
-- Tier-3 category (shopping_browse) and deepens culture_spot. Google-Places-
-- verified. Neighborhoods assigned precisely (Chaucer's is upper State; the
-- Mission is Mission Canyon) so this also nudges two thin neighborhoods.
-- These are also Downtown's first Tier-3 place rows.
-- ============================================================================
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('a8e8126b-df4d-5d09-93a3-7053404b59a0', 'place', 'needs_review', 'Chaucer''s Books', 'A beloved, fiercely independent bookstore in Loreto Plaza — packed floor-to-ceiling with a deep, owner-curated selection and a big children''s annex.', 'shopping', 3, 'shopping_browse', 'Lose an afternoon browsing one of the last great full-service independent bookstores on the South Coast.', 'upper_state', NULL, '3321 State St, Santa Barbara, CA 93105', 34.4397867, -119.7358737, NULL, true, false, '{morning,afternoon,evening}', 'ChIJeXFLRNwU6YARgoxQzsIlnck', 'placeholder', 'Chaucers Books Santa Barbara', 'In Loreto Plaza on upper State; knowledgeable staff and a large separate kids'' section. Open late most nights.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('f97fd218-c1a5-53ff-b3d7-ee04faefb24f', 'place', 'needs_review', 'The Book Den', 'One of the oldest bookstores in the West — a single-level downtown shop mixing new and used titles, with a standout sci-fi section.', 'shopping', 3, 'shopping_browse', 'Browse new and used books side by side at a downtown institution just off State Street.', 'downtown', 'downtown', '15 E Anapamu St, Santa Barbara, CA 93101', 34.4238855, -119.7040526, NULL, true, false, '{morning,afternoon}', 'ChIJRcS0kX0U6YAR9qpnfLkMvVo', 'placeholder', 'The Book Den Santa Barbara', 'A straightforward one-level layout with a used-book section; right by the library and museum.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('2a1ccfcf-4a68-5b4a-8d92-7afa1d2e1cb0', 'place', 'needs_review', 'Paradise Found', 'A welcoming downtown bookshop-and-gift store blending a thoughtful book selection with crystals, tarot, incense, candles, and jewelry.', 'shopping', 3, 'shopping_browse', 'Browse well-curated books and metaphysical gifts — crystals, tarot, incense — in a calm, friendly space.', 'downtown', 'downtown', '17 E Anapamu St, Santa Barbara, CA 93101', 34.4239771, -119.7040366, NULL, true, false, '{morning,afternoon}', 'ChIJDS-2kX0U6YARTCRQYuoiDOE', 'placeholder', 'Paradise Found Santa Barbara', 'Next door to The Book Den; staff offer readings and help with crystal selection. Open daily 11–6.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('afd623d6-45fd-5eed-b16e-b3a485d1cba0', 'place', 'needs_review', 'Santa Barbara Public Market', 'A lively downtown food hall gathering local vendors — Thai, Korean, tacos, a wine bar, bakery, and more — under one roof near the arts district.', 'shopping', 3, 'shopping_browse', 'Graze across a dozen local food and drink vendors in a casual, buzzy hall — easy for groups who can''t agree.', 'downtown', 'downtown', '38 W Victoria St, Santa Barbara, CA 93101', 34.4235528, -119.7069864, '$$', true, false, '{morning,afternoon,evening}', 'ChIJw28wXH0U6YARiA0rdWIPQNM', 'placeholder', 'Santa Barbara Public Market food hall', 'Buzzy and can get loud at peak times; portions vary by vendor. Open late Thursday–Saturday.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('62a1ea15-9019-5b92-89e5-a4dce8fac0d8', 'place', 'needs_review', 'Old Mission Santa Barbara', 'The "Queen of the Missions" — a 1786 Spanish mission on a hilltop with twin bell towers, a museum, gardens, and a historic cemetery, overlooking the city and sea.', 'culture', 3, 'culture_spot', 'Tour the landmark mission, museum, and gardens to understand Santa Barbara''s Spanish and Chumash history, with hilltop ocean views.', 'mission_canyon', NULL, '2201 Laguna St, Santa Barbara, CA 93105', 34.4383262, -119.7140678, '$$', true, false, '{morning,afternoon}', 'ChIJA20zJYEU6YARZ_lTVZWZACI', 'placeholder', 'Old Mission Santa Barbara', 'Open 9:30–4 daily; self-guided tour (~$17 adults) with QR-code stops. Avoid Mass times to see the church. A lawn out front is great for a picnic.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('921caa91-f437-5e64-b814-9d38305a120c', 'place', 'needs_review', 'Santa Barbara Museum of Art', 'A compact, well-regarded downtown art museum on State Street with strong European, American, and Asian collections — small enough to enjoy in a focused visit.', 'culture', 3, 'culture_spot', 'See Monet, Degas, and ukiyo-e prints in a walkable downtown museum, free on Second Sundays.', 'downtown', 'downtown', '1130 State St, Santa Barbara, CA 93101', 34.4232366, -119.7038966, NULL, true, false, '{morning,afternoon}', 'ChIJ-z0Kvn0U6YARim720QzUtwA', 'placeholder', 'Santa Barbara Museum of Art', 'Open Tue–Sun 11–5 (closed Mondays). Free admission every Second Sunday, sometimes with live music.', '2026-06-24'::timestamptz, 'seed:google_places'),
  ('c671bb72-7339-5cf1-99e8-68626d408be1', 'place', 'needs_review', 'Santa Barbara County Courthouse', 'A 1929 Spanish-Colonial Revival masterpiece — hand-painted ceilings, tiled halls, sunken gardens, and a clock tower with the best free view in town.', 'culture', 3, 'culture_spot', 'Climb the clock tower for a free panoramic view, then wander the murals, tiles, and sunken garden of this architectural landmark.', 'downtown', 'downtown', '1100 Anacapa St, Santa Barbara, CA 93101', 34.4242013, -119.7023282, 'free', true, false, '{morning,afternoon}', 'ChIJ36yr4n0U6YARDfRfXviq_oc', 'placeholder', 'Santa Barbara County Courthouse', 'Free to enter and climb the clock tower; free guided tours run twice daily. The garden and Sunken Garden host events. Open weekdays; check weekend access.', '2026-06-24'::timestamptz, 'seed:google_places')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('a8e8126b-df4d-5d09-93a3-7053404b59a0', 'solo', 0.70, 'ai'),
  ('a8e8126b-df4d-5d09-93a3-7053404b59a0', 'family_day', 0.55, 'ai'),
  ('f97fd218-c1a5-53ff-b3d7-ee04faefb24f', 'solo', 0.70, 'ai'),
  ('f97fd218-c1a5-53ff-b3d7-ee04faefb24f', 'arts_culture', 0.50, 'ai'),
  ('2a1ccfcf-4a68-5b4a-8d92-7afa1d2e1cb0', 'solo', 0.65, 'ai'),
  ('2a1ccfcf-4a68-5b4a-8d92-7afa1d2e1cb0', 'arts_culture', 0.50, 'ai'),
  ('afd623d6-45fd-5eed-b16e-b3a485d1cba0', 'wine_food', 0.65, 'ai'),
  ('afd623d6-45fd-5eed-b16e-b3a485d1cba0', 'family_day', 0.60, 'ai'),
  ('afd623d6-45fd-5eed-b16e-b3a485d1cba0', 'hosting_visitors', 0.55, 'ai'),
  ('62a1ea15-9019-5b92-89e5-a4dce8fac0d8', 'arts_culture', 0.90, 'ai'),
  ('62a1ea15-9019-5b92-89e5-a4dce8fac0d8', 'hosting_visitors', 0.75, 'ai'),
  ('62a1ea15-9019-5b92-89e5-a4dce8fac0d8', 'family_day', 0.55, 'ai'),
  ('921caa91-f437-5e64-b814-9d38305a120c', 'arts_culture', 0.95, 'ai'),
  ('921caa91-f437-5e64-b814-9d38305a120c', 'date_night', 0.55, 'ai'),
  ('921caa91-f437-5e64-b814-9d38305a120c', 'solo', 0.50, 'ai'),
  ('c671bb72-7339-5cf1-99e8-68626d408be1', 'arts_culture', 0.90, 'ai'),
  ('c671bb72-7339-5cf1-99e8-68626d408be1', 'hosting_visitors', 0.80, 'ai'),
  ('c671bb72-7339-5cf1-99e8-68626d408be1', 'free_sb', 0.85, 'ai')
on conflict do nothing;

-- ============================================================================
-- BATCH 17 — UPPER STATE depth (Tier-3)  — closes the last thin neighborhood.
-- Upper State reaches 3 rows (Lure B10 + Chaucer's B16 + Harry's here). Mission
-- Canyon already reached 4 (Botanic Garden, Inspiration Point, Old Mission), so
-- it needs no further fill this pass. A tight, targeted close rather than padding.
-- ============================================================================
insert into things (id, type, status, title, blurb, category, happening_tier, happening_category, reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band, indoor, is_21_plus, time_of_day_fit, place_id, photo_source, photo_query, local_note, last_confirmed, source) values
  ('76e80126-0919-5931-aa12-43c50d8fab85', 'place', 'needs_review', 'Harry''s Plaza Cafe', 'A timeless Loreto Plaza institution on upper State — red-leather booths, old Santa Barbara photos, hearty American fare, and famously generous cocktails.', 'food', 3, 'food_drink_spot', 'Settle into a vintage booth for a stiff martini and classic comfort food at a true local''s haunt.', 'upper_state', NULL, '3313 State St, Santa Barbara, CA 93105', 34.43927, -119.735939, '$$', true, false, '{afternoon,evening}', 'ChIJjRJDMdwU6YAR8prXB5QUCwQ', 'placeholder', 'Harrys Plaza Cafe Santa Barbara', 'In Loreto Plaza next to Chaucer''s Books; known for strong drinks and a loyal regular crowd. Open late.', '2026-06-24'::timestamptz, 'seed:google_places')
on conflict (id) do nothing;

insert into thing_tags (thing_id, tag, confidence, tag_source) values
  ('76e80126-0919-5931-aa12-43c50d8fab85', 'wine_food', 0.65, 'ai'),
  ('76e80126-0919-5931-aa12-43c50d8fab85', 'nightlife', 0.55, 'ai'),
  ('76e80126-0919-5931-aa12-43c50d8fab85', 'date_night', 0.50, 'ai')
on conflict do nothing;
