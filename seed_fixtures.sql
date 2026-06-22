-- DEV FIXTURES — delete before launch
-- ============================================================================
-- SB Daymaker — Stage 1 dev fixtures (Document 9, Stage 1).
-- ~25 THROWAWAY rows so the screens have something to render during the build.
-- Not real content: names are obvious placeholders ("(fixture)"). All rows are
-- marked source = 'seed_fixture' and use reserved id prefixes so cleanup is easy.
-- Inserted as status = 'published' so the app's publishable key can read them
-- (Row-Level Security only exposes published rows).
--
-- TO REMOVE LATER (run before loading real Stage-2 content):
--   delete from guides where id like '22222222-%';      -- cascades guide_stops
--   delete from things where source = 'seed_fixture';   -- cascades tags / windows / schedules
-- ============================================================================

begin;

-- ---- THINGS ---------------------------------------------------------------
insert into things
  (id, type, status, title, blurb, category, happening_tier, happening_category,
   reason_to_go, neighborhood, nearby_zone, address, lat, lng, price_band,
   indoor, is_21_plus, time_of_day_fit, starts_at, ends_at, buy_url,
   hero_eligible, last_confirmed, source)
values
-- Events (Tier 1, dated within the next ~2 weeks of 2026-06-22)
('11111111-1111-4111-8111-111111111101','event','published','Sunset Sounds Concert (fixture)','Golden-hour live music down by the water — bring a layer for when the breeze picks up.','music',1,'live_music','Tonight the stage faces the sunset.','waterfront','waterfront','123 Harbor Way, Santa Barbara, CA',34.4101,-119.6896,'$$',false,false,'{evening,late}'::tod[],'2026-06-25 19:30:00-07','2026-06-25 22:00:00-07','https://example.com/tickets',true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111102','event','published','Funk Zone Art Walk (fixture)','Studios and tasting rooms throw their doors open for one breezy evening of art and pours.','arts',1,'arts_theater','First-Thursday energy, gallery to gallery.','funk_zone','funk','100 Santa Barbara St, Santa Barbara, CA',34.4140,-119.6890,'free',false,false,'{evening}'::tod[],'2026-06-27 17:00:00-07','2026-06-27 20:00:00-07',NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111103','event','published','Goleta Family Fair (fixture)','Bounce houses, kettle corn, and a craft tent the kids will not want to leave.','community',1,'festival_fair','A no-stress morning out with the family.','goleta','goleta','5990 Hollister Ave, Goleta, CA',34.4358,-119.8276,'free',false,false,'{morning,afternoon}'::tod[],'2026-06-29 11:00:00-07','2026-06-29 15:00:00-07',NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111104','event','published','Downtown Food Truck Festival (fixture)','A dozen trucks line the block — come hungry, share plates, stay for the music.','food',1,'food_drink_event','Dinner is a lap around the block tonight.','downtown','downtown','1200 State St, Santa Barbara, CA',34.4208,-119.6982,'$$',false,false,'{evening}'::tod[],'2026-07-02 17:00:00-07','2026-07-02 21:00:00-07',NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111105','event','published','Mesa Outdoor Movie Night (fixture)','A classic on the big inflatable screen — blankets down, popcorn up.','community',1,'community_gathering','Bring a blanket and watch under the stars.','mesa','mesa','Cliff Dr, Santa Barbara, CA',34.4030,-119.7180,'free',false,false,'{late}'::tod[],'2026-07-05 20:00:00-07','2026-07-05 22:30:00-07',NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111106','event','published','Montecito Jazz Evening (fixture)','An intimate trio, low light, and a short list of very good wine.','music',1,'live_music','A grown-up night out, no fuss.','montecito','montecito','1100 Coast Village Rd, Montecito, CA',34.4367,-119.6313,'$$$',true,true,'{evening,late}'::tod[],'2026-07-03 19:00:00-07','2026-07-03 22:00:00-07','https://example.com/tickets',true,now(),'seed_fixture'),
-- Happy hours (Tier 2; 21+, so never family_day)
('11111111-1111-4111-8111-111111111107','happyhour','published','Harborview Happy Hour (fixture)','Dollar-off oysters and a sunset that does half the work.','food',2,'recurring_nightlife','Catch the deal before the sun drops.','waterfront','waterfront','200 Harbor Way, Santa Barbara, CA',34.4101,-119.6890,'$$',true,true,'{evening}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111108','happyhour','published','Funk Zone Tasting Room HH (fixture)','Flights at a friendly price and a patio made for lingering.','wine',2,'weekly_special','Wind down with a midweek flight.','funk_zone','funk','25 Anacapa St, Santa Barbara, CA',34.4138,-119.6905,'$$',false,true,'{afternoon,evening}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111109','happyhour','published','Downtown Cantina HH (fixture)','Margaritas, chips that keep coming, and a back patio that hums.','food',2,'recurring_nightlife','Start the night with a margarita.','downtown','downtown','500 State St, Santa Barbara, CA',34.4180,-119.6950,'$$',true,true,'{evening,late}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
-- First looks
('11111111-1111-4111-8111-111111111110','firstlook','published','First Look: New Mesa Bakery (fixture)','Just opened — morning buns that sell out by ten, so go early.','food',3,'food_drink_spot','Get there before the buns are gone.','mesa','mesa','1900 Cliff Dr, Santa Barbara, CA',34.4035,-119.7200,'$',false,false,'{morning}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111111','firstlook','published','First Look: Goleta Bookshop (fixture)','A brand-new indie shop with a deep local-authors shelf and a reading nook.','shopping',3,'shopping_browse','Be among the first to browse the shelves.','goleta','goleta','5700 Hollister Ave, Goleta, CA',34.4360,-119.8300,'$$',true,false,'{afternoon}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
-- Places (Tier 3 evergreen)
('11111111-1111-4111-8111-111111111112','place','published','Stearns Wharf Stroll (fixture)','A slow walk over the water with a view back at the hills.','outdoors',3,'scenic_chill','Classic SB, end to end in twenty minutes.','waterfront','waterfront','217 Stearns Wharf, Santa Barbara, CA',34.4096,-119.6855,'free',false,false,'{afternoon,evening}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111113','place','published','Funk Zone Coffee Crawl (fixture)','Three small roasters within a block — make a morning of it.','food',3,'food_drink_spot','A caffeinated tour of the neighborhood.','funk_zone','funk','30 Helena Ave, Santa Barbara, CA',34.4142,-119.6888,'$',false,false,'{morning}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111114','place','published','Downtown State Street Browse (fixture)','Window-shop the length of State, duck into the courtyards.','shopping',3,'shopping_browse','An easy afternoon of poking around.','downtown','downtown','800 State St, Santa Barbara, CA',34.4192,-119.6970,'$$',false,false,'{afternoon}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111115','place','published','Mesa Lane Beach Walk (fixture)','Steps down to a quieter stretch of sand — time it with low tide.','outdoors',3,'outdoor_activity','A locals beach without the crowd.','mesa','mesa','Mesa Ln, Santa Barbara, CA',34.4012,-119.7250,'free',false,false,'{morning,afternoon}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111116','place','published','Montecito Garden Tour (fixture)','Shaded paths, rare succulents, and benches made for slowing down.','arts',3,'culture_spot','A calm, green hour off the road.','montecito','montecito','1200 Coast Village Rd, Montecito, CA',34.4370,-119.6320,'$$',false,false,'{morning,afternoon}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111117','place','published','Goleta Beach Picnic (fixture)','Grassy tables, calm water, and a pier for the kids to walk out on.','outdoors',3,'scenic_chill','Pack lunch and claim a table.','goleta','goleta','5986 Sandspit Rd, Goleta, CA',34.4185,-119.8290,'free',false,false,'{afternoon}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111118','place','published','Riviera Sunset Viewpoint (fixture)','The whole town and the islands, gold at the right hour.','outdoors',3,'scenic_chill','Drive up just before sunset.','riviera','downtown','Alameda Padre Serra, Santa Barbara, CA',34.4380,-119.6890,'free',false,false,'{evening}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111119','place','published','Carpinteria Tide Pools (fixture)','Low tide turns the reef into an aquarium — sturdy shoes help.','outdoors',3,'outdoor_activity','Go at low tide for the best peek.','carpinteria',NULL,'Carpinteria Bluffs, Carpinteria, CA',34.3917,-119.5180,'free',false,false,'{morning}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111120','place','published','Mission Canyon Trailhead (fixture)','A shaded creekside start that climbs to a wide-open view.','outdoors',3,'outdoor_activity','Beat the heat with an early start.','mission_canyon',NULL,'Tunnel Rd, Santa Barbara, CA',34.4530,-119.7110,'free',false,false,'{morning}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111121','place','published','Upper State Wine Bar (fixture)','A neighborhood pour spot with a chalkboard that changes weekly.','wine',3,'food_drink_spot','Settle in for a glass and a board.','upper_state',NULL,'3500 State St, Santa Barbara, CA',34.4380,-119.7370,'$$',true,true,'{evening}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111122','place','published','Waterfront Kayak Launch (fixture)','Calm-water put-in — paddle out for a seal sighting or two.','outdoors',3,'outdoor_activity','Glassy mornings are the move.','waterfront','waterfront','125 Harbor Way, Santa Barbara, CA',34.4099,-119.6905,'$$',false,false,'{morning}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111123','place','published','Funk Zone Gallery (fixture)','A bright little space with rotating local shows — free to wander.','arts',3,'culture_spot','Duck in between tasting rooms.','funk_zone','funk','15 Gray Ave, Santa Barbara, CA',34.4145,-119.6895,'free',true,false,'{afternoon}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111124','place','published','Downtown Historic Theater (fixture)','A restored marquee house showing classics and the odd live act.','arts',3,'culture_spot','Check the marquee and make a night of it.','downtown','downtown','1300 State St, Santa Barbara, CA',34.4215,-119.6985,'$$',true,false,'{evening}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture'),
('11111111-1111-4111-8111-111111111125','place','published','Downtown Farmers Market (fixture)','Stalls of strawberries, flowers, and warm tamales every Saturday.','food',2,'recurring_market','Saturday mornings, rain or shine.','downtown','downtown','Santa Barbara St & Cota St, Santa Barbara, CA',34.4185,-119.6960,'free',false,false,'{morning}'::tod[],NULL,NULL,NULL,true,now(),'seed_fixture');

-- ---- THING_TAGS (occasion tags; honor the negative rules) -----------------
insert into thing_tags (thing_id, tag, confidence, tag_source) values
('11111111-1111-4111-8111-111111111101','catch_a_show',0.90,'ai'),
('11111111-1111-4111-8111-111111111101','date_night',0.80,'ai'),
('11111111-1111-4111-8111-111111111102','arts_culture',0.90,'ai'),
('11111111-1111-4111-8111-111111111102','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111102','date_night',0.70,'ai'),
('11111111-1111-4111-8111-111111111103','family_day',0.95,'ai'),
('11111111-1111-4111-8111-111111111103','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111104','wine_food',0.90,'ai'),
('11111111-1111-4111-8111-111111111104','family_day',0.70,'ai'),
('11111111-1111-4111-8111-111111111105','family_day',0.90,'ai'),
('11111111-1111-4111-8111-111111111105','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111106','date_night',0.95,'ai'),
('11111111-1111-4111-8111-111111111106','nightlife',0.80,'ai'),
('11111111-1111-4111-8111-111111111107','wine_food',0.85,'ai'),
('11111111-1111-4111-8111-111111111107','nightlife',0.80,'ai'),
('11111111-1111-4111-8111-111111111108','wine_food',0.90,'ai'),
('11111111-1111-4111-8111-111111111108','date_night',0.75,'ai'),
('11111111-1111-4111-8111-111111111109','nightlife',0.90,'ai'),
('11111111-1111-4111-8111-111111111110','solo',0.80,'ai'),
('11111111-1111-4111-8111-111111111110','family_day',0.70,'ai'),
('11111111-1111-4111-8111-111111111111','solo',0.80,'ai'),
('11111111-1111-4111-8111-111111111111','arts_culture',0.70,'ai'),
('11111111-1111-4111-8111-111111111112','hosting_visitors',0.90,'ai'),
('11111111-1111-4111-8111-111111111112','family_day',0.80,'ai'),
('11111111-1111-4111-8111-111111111112','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111113','solo',0.80,'ai'),
('11111111-1111-4111-8111-111111111113','wine_food',0.70,'ai'),
('11111111-1111-4111-8111-111111111114','hosting_visitors',0.85,'ai'),
('11111111-1111-4111-8111-111111111114','solo',0.70,'ai'),
('11111111-1111-4111-8111-111111111115','outdoors_active',0.90,'ai'),
('11111111-1111-4111-8111-111111111115','solo',0.70,'ai'),
('11111111-1111-4111-8111-111111111115','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111116','arts_culture',0.80,'ai'),
('11111111-1111-4111-8111-111111111116','date_night',0.70,'ai'),
('11111111-1111-4111-8111-111111111117','family_day',0.90,'ai'),
('11111111-1111-4111-8111-111111111117','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111118','date_night',0.85,'ai'),
('11111111-1111-4111-8111-111111111118','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111119','family_day',0.85,'ai'),
('11111111-1111-4111-8111-111111111119','outdoors_active',0.90,'ai'),
('11111111-1111-4111-8111-111111111119','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111120','outdoors_active',0.95,'ai'),
('11111111-1111-4111-8111-111111111120','solo',0.70,'ai'),
('11111111-1111-4111-8111-111111111120','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111121','wine_food',0.90,'ai'),
('11111111-1111-4111-8111-111111111121','date_night',0.80,'ai'),
('11111111-1111-4111-8111-111111111122','outdoors_active',0.90,'ai'),
('11111111-1111-4111-8111-111111111122','family_day',0.70,'ai'),
('11111111-1111-4111-8111-111111111123','arts_culture',0.85,'ai'),
('11111111-1111-4111-8111-111111111123','solo',0.70,'ai'),
('11111111-1111-4111-8111-111111111123','free_sb',0.95,'ai'),
('11111111-1111-4111-8111-111111111124','catch_a_show',0.90,'ai'),
('11111111-1111-4111-8111-111111111124','arts_culture',0.75,'ai'),
('11111111-1111-4111-8111-111111111125','family_day',0.85,'ai'),
('11111111-1111-4111-8111-111111111125','wine_food',0.70,'ai'),
('11111111-1111-4111-8111-111111111125','free_sb',0.95,'ai');

-- ---- HAPPY_HOUR_WINDOWS (for the happyhour-type things) -------------------
insert into happy_hour_windows (thing_id, day_of_week, starts_local, ends_local, deal_text) values
('11111111-1111-4111-8111-111111111107',4,'16:00','18:00','$1 off oysters'),
('11111111-1111-4111-8111-111111111107',5,'16:00','18:00','$1 off oysters'),
('11111111-1111-4111-8111-111111111108',3,'17:00','19:00','$5 flights'),
('11111111-1111-4111-8111-111111111108',6,'15:00','17:00','$5 flights'),
('11111111-1111-4111-8111-111111111109',1,'15:00','18:00','2-for-1 margaritas'),
('11111111-1111-4111-8111-111111111109',4,'15:00','18:00','2-for-1 margaritas');

-- ---- RECURRING_SCHEDULES (Tier-2 rhythms) --------------------------------
insert into recurring_schedules (thing_id, category, day_of_week, start_time, end_time, label, last_confirmed) values
('11111111-1111-4111-8111-111111111125','recurring_market',6,'08:30','13:00','Saturday Farmers Market',current_date),
('11111111-1111-4111-8111-111111111121','weekly_special',3,'17:00','21:00','Wine Down Wednesday',current_date);

-- ---- GUIDES (one neighborhood guide w/ zone; one theme guide w/ tag) ------
insert into guides (id, title, kicker, intro, kind, zone, tag, cover_url, status) values
('22222222-2222-4222-8222-222222222201','Funk Zone Wander (fixture)','Eat, sip, repeat','A loose loop through SBs artsiest blocks — galleries, coffee, and tasting rooms.','neighborhood','funk',NULL,NULL,'published'),
('22222222-2222-4222-8222-222222222202','Date Night in SB (fixture)','For two','Low-light dinners, a show, and a view to end on.','theme',NULL,'date_night',NULL,'published');

-- ---- GUIDE_STOPS ----------------------------------------------------------
insert into guide_stops (guide_id, position, thing_id, label, note) values
('22222222-2222-4222-8222-222222222201',1,'11111111-1111-4111-8111-111111111113','Coffee to start','Begin with a Funk Zone coffee crawl.'),
('22222222-2222-4222-8222-222222222201',2,'11111111-1111-4111-8111-111111111108','A midday flight','Pop into a tasting room.'),
('22222222-2222-4222-8222-222222222201',3,'11111111-1111-4111-8111-111111111123','Gallery wander','Free local art between pours.'),
('22222222-2222-4222-8222-222222222201',4,'11111111-1111-4111-8111-111111111102','Art Walk finish','If it is a Thursday, end on the Art Walk.'),
('22222222-2222-4222-8222-222222222202',1,'11111111-1111-4111-8111-111111111121','A glass first','Open with a pour at the wine bar.'),
('22222222-2222-4222-8222-222222222202',2,'11111111-1111-4111-8111-111111111124','Catch a show','Check the historic theater marquee.'),
('22222222-2222-4222-8222-222222222202',3,'11111111-1111-4111-8111-111111111106','Live jazz','An intimate trio in Montecito.'),
('22222222-2222-4222-8222-222222222202',4,'11111111-1111-4111-8111-111111111118','End on a view','Sunset from the Riviera.');

commit;

-- Sanity check (optional): select count(*) from things where source = 'seed_fixture';  -- expect 25
