# R1 Progress (Claude Code keeps this current)

Branch: remediation-r1 (cut from `main` at `e823ab1`, the production branch)
Current run: B
Current wave: 3 complete, starting 4
Current task: W4.1

## Done (wave.task, commit)

- Setup: R1 DDL verified live (all 5 columns present, anon reads archived, needs_review still hidden). Nothing to paste.
- Setup: branch `remediation-r1` created from `main`.
- Setup: `docs/audits/SB Daymaker UI Audit Log.md` renamed to `SB_Daymaker_UI_Audit_Log.md`, the path the specs cite.
- Setup: environment repair, dependencies moved out of iCloud sync to `node_modules.nosync` with a `node_modules` symlink; `vitest.config.ts` excludes it. Without this nothing could run (see BASELINE.md).
- Setup: fixed the one pre-existing test failure, `ingest/adapters/generic.test.ts:46`, a date-dependent test, not a code defect. Suite green at 864 tests in 59 files.
- Setup: BASELINE.md recorded.
- W1.1 saves resolve by id and are never auto-deleted. `getThingsByIds()` added (chunks of 200, published + archived, no tier/quality/row limits). /saved fetches client-side after hydration, renders unresolvable ids as "No longer listed" with a Remove control, and archived rows keep want/been with an "Already happened, [date]" line. The pool-diff cleanup effect is gone.
- W1.2 the public pool excludes finished events, archived rows, and never truncates. See "Deviations" below.
- W1.3 pool consumers agree: `getStopThingMap()` now shares `PUBLIC_STATUSES` with `getThingsByIds()`. Search reads the same pool and returns Helena Avenue Bakery.
- W1.4 the backup panel shows from the first save, compact between 1 and 4.
- W1.5 the share link is always visible. A new `useShareLink()` hook renders a sheet with the URL and a Copy control whenever the native share sheet does not take it, wired into all five share surfaces.
- W1.6 `POST /api/revalidate` (CRON_SECRET bearer) added and called at the end of a successful ingest run; `/plan` added to `revalidatePublic()`; ISR lowered 600 -> 300 on /saved, /plan, /discover, /discover/[id], /thing/[id].
- W1 extra: hardened `SavesProvider` against a corrupt-storage wipe (see "Deviations").
- W1 commit: `fix(r1-w1): saves resolve by id, pool excludes finished events, share link visible, revalidate after ingest`
- W2.1 archive step (`ingest/retire.ts`), called nightly from `ingest/run.ts`, plus `npm run retire:dryrun` / `retire:apply`. CP1 approved; 1,017 rows archived, then 4 more on the next day's run. Published 1,529 -> 508. Re-ingest safety confirmed (land upserts with ignoreDuplicates, publish gate only touches needs_review), so no change was needed there.
- W2.2 archived detail pages stay reachable with an "already happened on [date]" banner, noindex, a working save heart, the year on out-of-month dates (DET-001), and the 90-day cap on the Verified stamp (DET-014). The shared-list page now resolves ids directly instead of filtering the browse pool, so an archived item is marked rather than silently dropped; the restore page names how many already happened.
- W2.3 civic flag: `ingest/civic.ts` (rules as editable data), set at land time for new rows, backfilled over existing ones (136 rows). The pool, and therefore search and Plan, exclude civic. See "Deviations".
- W2.4 CP2 approved. `hero_eligible` pass applied: 49 of 512 rows lost eligibility, 463 remain. `pickAutoHero` now requires eligibility, a real address and a start that has not passed by more than 30 minutes; the bare `ordered[0]` fallback is gone; the pick is computed before Place/Occasion/Activity so no filter combination can blank it.
- W2.5 "Gray day move" now needs genuinely gray weather (rain, fog, overcast or broken cloud, never few/scattered/partly) AND an indoor-capable pick.
- W2.6 the nearby list dedupes by normalized title, excludes civic and finished events, and caps at 5.
- W2.7 the Live catalog gained an Archived filter, a civic filter, and Civic/Archived chips per row. Read-only; no new write route.
- W2 commit: `feat(r1-w2): archive finished events, civic flag, real pick eligibility, eyebrow and nearby fixes`
- W3.1 `isFood()` now excludes civic rows, food-service titles (food bank, pantry, meal service, soup kitchen), library-source programming, and free food EVENTS outside a named allowlist (market, tasting, pop-up, food truck, happy hour). Data pass recategorized 47 rows out of the food category (25 Food Distribution, 22 LOTG bookmobile stops), more than the spec's four because archiving had since revealed the rest.
- W3.2 one notes reducer (`lib/plan/notes.ts`). Both meals.ts and validate.ts now key their notes by subject, so the same gap is stated once in the more informative wording. A draft under two stops says so; an unfillable block renders its slot with "Nothing found for [block] yet"; Regenerate excludes the current draft and, when the pool is exhausted, says so rather than emptying the day.
- W3.3 the chosen area now outranks area-less candidates in the ranker, at most one area-less stop may ride along, walking days check an area-less candidate's coordinates against the area's box, and the draft says "We widened beyond [area] to fill the day" when it had to reach outside.
- W3.4 the Plan horizon is 31 days, matching Explore's Month reach.
- W3.5 a shared `Badge` component with a real space in the text stream and its own aria-label, fixing "Cookingdinner", "AFTERNOONNOW" and "THE CORENOW" in one change.
- W3.6 "Seven quick questions"; "Night" is "Evening" everywhere; a stop shows "From your saves" OR "Suggested", never both.
- W3.7 `plan_built` carries `stops` and `notes` counts, integers only.
- W3 commit: `fix(r1-w3): plan honors meals and area, honest notes, badge component, horizon to 31 days`

## Checkpoints
- CP1 archive dry-run: approved 2026-09-21
- CP2 hero_eligible pass: approved 2026-09-22
- CP3 area backfill: pending
- CP4 card rebuild: pending
- CP5 canon diff: pending

## Blocked (task, reason, what would unblock it)

- **Pushing `remediation-r1` to GitHub, and therefore any Vercel preview deployment.**
  Reason: iCloud has evicted 7,528 of the 9,591 loose objects in `.git/objects`, and it
  will not fetch them back. Any read of one blocks forever in a synchronous `pread`
  (the same failure that stopped the test suite running at kickoff, confirmed again
  here: `brctl download .git/objects` returns success and materializes nothing, and a
  direct read of a sample object hangs until killed). `git push` has to read the
  historical objects to build a pack, so it hangs at zero CPU. Credentials are fine
  (osxkeychain has a valid GitHub token), so this is not an auth problem.
  Both R1 commits are intact locally; the objects Claude wrote are materialized.
  What would unblock it: getting iCloud Drive syncing again for this folder (check
  System Settings > Apple Account > iCloud for a paused sync, a storage-full warning,
  or a sign-in prompt), or moving the repo out of `~/Documents` to a non-synced path,
  which is the durable fix and would also retire the `.nosync` workarounds.
  Until then, review happens on the local preview server instead of a Vercel preview.

## Deviations from the spec, and why

- **W1.2 paging, not `.limit(2000)`.** The spec says add an explicit `.limit(2000)` and page if the total exceeds the returned count. Measured: PostgREST's `db-max-rows` ceiling on this project is a hard 1,000. Both `limit=2000` and `Range: 0-1999` still return exactly 1,000 rows, so a larger limit cannot lift it. The pool now pages with `.range()` until the server's own `count: "exact"` total is satisfied, and logs a warning if it ever comes up short. Same intent, the mechanism that actually works here.
- **W1.2 added an explicit `status = 'published'` predicate.** Not in the spec, because the spec assumed the query already had one. It did not; it relied entirely on RLS. See BASELINE.md, this is what let the R1 DDL push 436 archived rows into the live pool.
- **W1.3 shared the row rule, not the column list.** The spec says `getStopThingMap()` should use one shared select constant with `getPublishedThings()`. Its stated purpose is that a guide must never offer a heart on something Saved cannot render, which is about which ROWS each read can return. Making the columns identical would have changed guide sub-lines: `getStopThingMap` selects `things.category`, a hand-curated field set on 109 rows, which is a different column from the pool's `happening_category`. The status rule is shared; the projection stays narrow.
- **W1.1 test is a pure-function test plus a source guard, not a component render test.** This repo has no React component-test harness and no `@testing-library`, and adding one is outside R1. The decision is extracted into the pure `partitionSaves()` in lib/savedView.ts and tested there (the spec's exact three-ids-two-returned case). `components/saved/noAutoDelete.test.ts` additionally pins the regression itself: no `remove()` call may appear inside any effect in SavedClient.
- **Extra fix in `SavesProvider`.** Hydration swallowed a `JSON.parse` failure and then the persist effect wrote `{}` straight back over the stored value, destroying the visitor's list on a single bad read. That is a save-deletion path, which is exactly what Wave 1 exists to close, so it is fixed here: an unreadable value is preserved, copied to `sbd.saves.v1.unreadable`, and never overwritten until the visitor actually saves something. Verified in a browser for both truncated JSON and a wrong-shaped value.

### Wave 2 deviations

- **The city calendar is title-tested, not blanket-flagged as civic.** W2.3 says to set `is_civic` on every `calendar.santabarbaraca.gov` row at the adapter. Checked against the real data, that calendar is mixed: blanket-flagging it would have hidden Friday Night Swing at Carrillo Recreation Center, the Santa Barbara Arts and Crafts Show on Cabrillo Boulevard, Chess Club, Scrabble Club, Knitting and Crochet Club, Memory Cafe, Volunteer Gardening, Neighborhood Cleanup and all of Creek Week, 23 of the 40 published rows from that source and about 5 percent of the live catalog. D3's subject is "civic MEETINGS", and the title rules separate meetings from programming cleanly: checked against all 40, every municipal meeting is caught and every real activity is kept. `CIVIC_SOURCES` still exists and is documented, so moving the host back into it is a one-line override.
- **"board" and "advisory board" are not civic on their own.** Bare "board" would have hidden Board Game Night, Paddle Board Yoga and Charcuterie Board Workshop; "advisory board" would have hidden the library's Teen Advisory Board. Both are caught only in municipal shapes ("Board of", "Design Board", "Board Meeting"). Genuine advisory bodies all carry "committee" or "council" and are caught by those.
- **Two rules added beyond the spec's list**, both from real rows the first pass missed: "Arts Advisory Meeting" (an advisory body's meeting with no board/committee/council word) and "Delayed Opening Hours" (a closure notice).
- **`hero_eligible` lands at 463 of 512, a smaller cut than acceptance line 7 anticipated.** The earlier steps did most of the work: archiving removed 1,017 dead rows and the civic flag keeps 22 more out of the pool entirely, so eligibility is now a second line of defence rather than the main filter. Reported at CP2 and approved.
- **19 rows lose eligibility purely for a placeholder address**, several of them good events at real venues (a show at SOhO, a Natural History Museum open house, Creek Week walks). The rule is right for the front page, and Wave 4's area backfill fixes the underlying data and hands them back. They remain in the feed throughout; only the pick is affected.
- **The fallback pick's sentence changed.** "Nothing matches that exactly today" now appears only when the visitor's filters return nothing. When the pick is a fallback because nothing dated qualifies, it says "Nothing dated today", which is what is actually true; blaming the filters was wrong once the pick stopped depending on them.

## TP-A3-03 investigation (W1.6 asked for a cause, not a fix)

The detail route declares `revalidate` but production serves it `no-store`. **Cause: no route in this app defines `generateStaticParams`.** In this Next version a dynamic segment with no generated params is rendered at request time, so `revalidate` has no prerendered entry to attach to. The build output states it plainly: `/thing/[id]` and `/discover/[id]` are marked `f (Dynamic) server-rendered on demand`, while `/saved` and `/plan` are `o (Static)` at the new 5m window. There is no `cookies()`, `headers()` or `connection()` call and no middleware opting the route out, so this is not the one-line fix the spec authorized. Left alone. Adding `generateStaticParams` is a real decision (which of ~430 things to prerender at build time) and belongs with the Wave 6 performance work.

## Notes for the next session

- Wave 1 verification: 884 unit tests green (61 files, 20 added), 10 of 10 browser acceptance checks green at 390px across three consecutive runs, production build clean, em dash check clean.
- ESLint reports 74 pre-existing errors repo-wide. None are in files R1 has touched (the only overlap, `ingest/run.ts`, carries a pre-existing unused-import warning). `components/saves/SavesProvider.tsx` had one `set-state-in-effect` error before R1 and still has exactly one.
- `lib/venuePool.test.ts:67` fails `tsc --noEmit` on the production branch (an inferred array-literal type with no `visual_kind`). Pre-existing, does not block the build, left alone.
- **Live regression found at baseline, fixed by W1.2.** `getPublishedThings()` has no `status` filter and relies on RLS alone. The R1 DDL's `things_read_archived` policy therefore pushed 436 archived rows into the public pool, taking evergreen places (tier 2 and 3) to zero and dropping Lighthouse performance on `/` from 66 to 34. W1.2 must add an explicit `.eq("status", "published")`, which the spec assumed was already there. Same applies to `getNearbyThings()`.
- `getThing()` / `fetchThing()` also has no status filter, so archived detail pages already resolve. W2.2 wants that, but it is currently accidental rather than intended. W2.2 should make it explicit and add the banner.
- The index's "597-test suite" figure is stale. Real count is 864.
