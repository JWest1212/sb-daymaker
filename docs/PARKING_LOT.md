# Parking lot

Decisions and work deliberately set aside. Nothing here is a bug to surprise-fix;
pick an item up on purpose, then move it out of this list.

## Parked decisions (Jim, 2026-09-22)

- **The homepage headline, "Everything worth doing in Santa Barbara, in one place."** It stays as is for now. The gap it hides: 86 percent of upcoming events are Downtown, and Waterfront, the Mesa and Upper State have none. Revisit when coverage outside Downtown improves, or soften the line.
- **Plan's Funk Zone parking tip.** `lib/plan/parkingByZone.ts` says to park once in the lot off Garden; the Funk Zone guide says the lots are a trap and to park on Anacapa above Yanonali. One of the two should change.

## Left over from R1 (specified in the waves, not finished)

- **Wave 5 pipeline runs.** The AI re-enrichment batch (thin blurbs, blurbs naming the wrong weekday) and the W5.7 image waterfall change. The rules and validators shipped; the runs did not.
- **Title cleaning at landing.** `ingest/clean.ts` `cleanTitle` only runs as a backfill; `ingest/land.ts` does not call it, so new titles wait for a manual run.
- **W4.4 forward rule.** Rows with an address but no area should land as `needs_review`; no such gate exists.
- **Homepage speed.** Mobile LCP target is under 4 s; it was 9.0 s on localhost and has never been measured on a real deployment. Measure on production after PR #21 merges.

## Deferred beyond R1 (known, by design)

- Series data-model consolidation (D6): one row per series instead of one per occurrence.
- A civic surface (D3, D14): civic rows ingest but nothing public reads them.
- Saved plans: no screen lists them, so "Save this plan" is hidden; the itineraries store is also claimed by two modules.
- Guide stop marking (the passport and stamp): hidden until built.
- A cockpit editor for guides (including the next-guide notice, `content.upcoming`).
- Full category name on card pills ("Arts" vs "Arts & Culture"), which needs the 90px pill redesigned.
- The sample digest is always framed as the weekend edition, even before a Sunday send.
- The big-type card fallback prints an old area code as its big word.
- Dead listing and guide URLs are blank with JavaScript off (they answer 404 correctly).
- Detail pages render on demand rather than prerendering (no `generateStaticParams`).
- The migrations folder does not hold every applied change, the R1 DDL included.
- Dead code: `lib/pipeline.ts`, `lib/enrich.ts`, `OnePerfectDayCard`, `MyPlansDrawer`, `SavedDays`.
- 74 pre-existing lint errors and one pre-existing type error in `lib/venuePool.test.ts`.
