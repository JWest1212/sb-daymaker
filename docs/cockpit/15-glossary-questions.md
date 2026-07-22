# Section 16 - Glossary

Product and Cockpit vocabulary an outside reader needs. Terms are also defined at first use in the body files; this is the consolidated reference.

- Thing: the canonical content row (table things): an event, recurring happening, or place shown on the public site.
- Tier / happening_tier: 1 = dated event ("Events"), 2 = recurring happening ("Recurring"), 3 = evergreen place ("Places"). Screens variously render these as Events/Recurring/Places, Tier 1/2/3, or T1/T2/T3.
- Queue / needs_review: things awaiting the founder's decision on SCR-01; the pipeline lands rows in this status nightly.
- Publish / Approve: setting a thing's status to published (API-56); also stamps last_confirmed and assigns a slug. Reject sets status archived.
- Trust chip: the green/amber/blue pill on each queue card: "Deterministic start" (dated, source-verified), "Confirm cadence" (recurring), "Evergreen" (place). Derived by chipFor(); there is deliberately no red (bad times are dropped pre-queue).
- Golden Rule / trust rule: sponsor status (things.is_featured, sponsor_id) must never influence ranking or selection anywhere. Founder curation that IS allowed: editorial_weight and hero pins.
- Editorial weight: the -5..+5 founder ranking nudge (WeightNudge, things.editorial_weight) the public ranker reads.
- Hero / hero_eligible / hero pin: the front page's marquee card. The ⭑ flag (hero_eligible) marks a thing as pool-eligible; a pin (hero_pins row) forces a specific thing for a specific date; unpinned days use the ranker's "Auto" pick.
- Overlay / pending edit / thing_edits: a founder edit of a LIVE thing stored as a thing_edits row; appears as a gold queue card; approving applies it to the live row.
- Drop / ingest_drops: a candidate the nightly gate rejected (no deterministic start, duplicate, etc.), listed in "Dropped tonight".
- Source / source key: a place events come from (Ticketmaster, SOhO, ...). Registry rows live in the sources table (SCR-03); per-run stats in source_runs.
- Below baseline: a source whose last yield fell under 34% of its own expected_yield (sourceHealth()); replaces global thresholds.
- Restock / directive: a targeted "find more X for the next N days" instruction (restock_directives) consumed by the nightly worker, or dispatched immediately via GitHub Actions ("Run now").
- Coverage / window / floor: counts of published Tier 1+2 occurrences per vibe or zone over the next 7/14/30/45 days; floors (3/5/8/10) mark a cell red regardless of relative rank.
- Vibe / occasion tag: the ten thing_tags values (date_night, family_day, nightlife, catch_a_show, arts_culture, outdoors_active, wine_food, free_sb, hosting_visitors, solo) that drive the public "occasion" doors.
- Zone / door-zone / nearby_zone: the eight coarse areas (Downtown, Funk Zone, Waterfront, The Mesa, Mission/Riviera, Uptown, Goleta/IV, Montecito+) plus "other"; powers the public Place door and coverage-by-neighborhood.
- Neighborhood Sweep: the free resolver + triage desk (SCR-04) that assigns nearby_zone to published things; its reusable asset is the venue dictionary (venue_neighborhoods).
- Recurring rhythm / registry: a founder-maintained standing happening (recurring_rhythms) the scrapers cannot reliably find; SCR-05 manages it; registry-candidate queue cards emit a paste-ready snippet.
- Venue / pool / approved photo: venues own curated photo pools (venue_photos, target 3-5 approved); attached things rotate through the pool with compliant refresh. "Attach" links a thing to a venue.
- Motif: the branded gradient placeholder a thing shows when it has no real photo. "Leave on motif" / "Keep motif" = permanent dismissal from the Images backlog (things.photo_ack / no_venue_ack).
- Image waterfall / budget: the photo sourcing order (venue pool, Wikimedia free, Google paid) with a monthly Google-call cap tracked in image_spend and shown by the BudgetChip ("{used}/{cap} Google calls").
- Images desk: SCR-10, the keyboard-first backlog worker for published things without a real photo.
- Edition: the twice-weekly email (editions + edition_picks): drafted automatically Wed/Sat 06:00 PT, sent Thu/Sun 07:00 PT. Slots: hero ("The Move"), secondaries, non-event, anchor ("Always worth it"). Hold ("skipped" in the DB) is the only action that stops a send.
- Chrome (edition): the subject/preheader/greeting fields.
- Local's secret: the hero pick's optional extra note, rendered only at ~40+ characters.
- Redraft: queueing a thing for tonight's AI re-write of blurb/tags (enrich_directives); lands back as a pending-edit overlay.
- Data confidence / auto-publish gate: the pipeline's 0-1 trust score (things.data_confidence); high scorers auto-publish (audit_log auto_publish), low scorers hold for review; SCR-01's "Time reclaimed" panel counts the win since 2026-07-16.
- Merged / un-merge: dedupe archived a duplicate and pointed merged_into at the survivor; MergedPanel reverses it.
- Flag: a visitor-submitted correction (content_flags) triaged on SCR-11.
- Cockpit v2: the 2026-07-02 shell redesign (topbar + tab strip); "Phase 8 cockpit" = the legacy app/cockpit/* surface.
- Founder / operator / Jim: the single human user; audit_log actor is always "founder".
- Worker / nightly / 2 a.m.: the GitHub Actions ingest (ingest/run.ts) that fetches, gates, dedupes, enriches, and lands content overnight (the UI copy says "tomorrow at 2 a.m." local; the heartbeat expects ~09:00 UTC starts).

# Section 17 - Open Questions / Gaps

Things the codebase alone cannot answer; a live-site walkthrough should close each.

1. Session refresh behavior: with no middleware, do auth cookies actually refresh reliably during long cockpit sessions, and what does an expired session do to the fire-and-forget approve path? (08-auth-permissions.md 9.1; the supabaseServer.ts comment assumes a middleware that does not exist.)
2. Live-DB schema vs repo: the exact shape of content_flags, enrich_directives, url_redirects, things.slug, things.no_venue_ack (all drift items in 06-data-architecture.md 7.2) - only the Supabase dashboard can confirm columns/constraints.
3. Is GITHUB_DISPATCH_TOKEN currently configured? Memory/docs (2026-07-02) say the restock "Run now" needed a fresh token; if still unset, that button always falls back to "Queued for tonight instead."
4. Is DIGEST_TO set in production? If not, the heartbeat dead-man's-switch alerts no one (10-observability.md 11.3).
5. Real data volumes: queue depth, catalog size vs the 2000-row cap, venues "Matches to review" overflow past 40, images backlog vs the 1000 cap - all determine whether the hidden-cap pain points (14-ux-pain-points.md item 6) are theoretical or daily.
6. The morning digest email's actual content/links (sent by the worker, not visible in app code): how much of the "what needs me today" rollup gap it already covers.
7. Whether any Supabase RLS policies exist on the touched tables (the SQL sources define some; the live DB may differ) - immaterial to the service-role Cockpit but material to risk assessment.
8. Auth account inventory: whether exactly one Supabase user exists (any signed-in user is treated as the admin).
9. Whether the ingest GitHub Action's schedule and the "2 a.m." UI copy still agree (heartbeat implies 09:00 UTC = 2 a.m. PDT; DST drift is accepted per code comments).
10. Behavior of the edition preview iframe on very long editions (fixed 2200px height, cockpit.css line 408): does content clip in practice?
11. The Anthropic blurb-edit endpoint's real-world failure modes (rate limits, safety refusals) - only observable live (API-20).
12. Whether any real traffic hits the legacy /cockpit URL (analytics for admin routes do not exist in-app).
