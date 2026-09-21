# R1 Progress (Claude Code keeps this current)

Branch: remediation-r1 (cut from `main` at `e823ab1`, the production branch)
Current run: A
Current wave: 1 complete, starting 2
Current task: W2.1

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

## Checkpoints
- CP1 archive dry-run: pending
- CP2 hero_eligible pass: pending
- CP3 area backfill: pending
- CP4 card rebuild: pending
- CP5 canon diff: pending

## Blocked (task, reason, what would unblock it)

Nothing blocked.

## Deviations from the spec, and why

- **W1.2 paging, not `.limit(2000)`.** The spec says add an explicit `.limit(2000)` and page if the total exceeds the returned count. Measured: PostgREST's `db-max-rows` ceiling on this project is a hard 1,000. Both `limit=2000` and `Range: 0-1999` still return exactly 1,000 rows, so a larger limit cannot lift it. The pool now pages with `.range()` until the server's own `count: "exact"` total is satisfied, and logs a warning if it ever comes up short. Same intent, the mechanism that actually works here.
- **W1.2 added an explicit `status = 'published'` predicate.** Not in the spec, because the spec assumed the query already had one. It did not; it relied entirely on RLS. See BASELINE.md, this is what let the R1 DDL push 436 archived rows into the live pool.
- **W1.3 shared the row rule, not the column list.** The spec says `getStopThingMap()` should use one shared select constant with `getPublishedThings()`. Its stated purpose is that a guide must never offer a heart on something Saved cannot render, which is about which ROWS each read can return. Making the columns identical would have changed guide sub-lines: `getStopThingMap` selects `things.category`, a hand-curated field set on 109 rows, which is a different column from the pool's `happening_category`. The status rule is shared; the projection stays narrow.
- **W1.1 test is a pure-function test plus a source guard, not a component render test.** This repo has no React component-test harness and no `@testing-library`, and adding one is outside R1. The decision is extracted into the pure `partitionSaves()` in lib/savedView.ts and tested there (the spec's exact three-ids-two-returned case). `components/saved/noAutoDelete.test.ts` additionally pins the regression itself: no `remove()` call may appear inside any effect in SavedClient.
- **Extra fix in `SavesProvider`.** Hydration swallowed a `JSON.parse` failure and then the persist effect wrote `{}` straight back over the stored value, destroying the visitor's list on a single bad read. That is a save-deletion path, which is exactly what Wave 1 exists to close, so it is fixed here: an unreadable value is preserved, copied to `sbd.saves.v1.unreadable`, and never overwritten until the visitor actually saves something. Verified in a browser for both truncated JSON and a wrong-shaped value.

## TP-A3-03 investigation (W1.6 asked for a cause, not a fix)

The detail route declares `revalidate` but production serves it `no-store`. **Cause: no route in this app defines `generateStaticParams`.** In this Next version a dynamic segment with no generated params is rendered at request time, so `revalidate` has no prerendered entry to attach to. The build output states it plainly: `/thing/[id]` and `/discover/[id]` are marked `f (Dynamic) server-rendered on demand`, while `/saved` and `/plan` are `o (Static)` at the new 5m window. There is no `cookies()`, `headers()` or `connection()` call and no middleware opting the route out, so this is not the one-line fix the spec authorized. Left alone. Adding `generateStaticParams` is a real decision (which of ~430 things to prerender at build time) and belongs with the Wave 6 performance work.

## Notes for the next session

- Wave 1 verification: 884 unit tests green (61 files, 20 added), 10 of 10 browser acceptance checks green at 390px across three consecutive runs, production build clean, em dash check clean.
- ESLint reports 74 pre-existing errors repo-wide. None are in files R1 has touched (the only overlap, `ingest/run.ts`, carries a pre-existing unused-import warning). `components/saves/SavesProvider.tsx` had one `set-state-in-effect` error before R1 and still has exactly one.
- `lib/venuePool.test.ts:67` fails `tsc --noEmit` on the production branch (an inferred array-literal type with no `visual_kind`). Pre-existing, does not block the build, left alone.
- **Live regression found at baseline, fixed by W1.2.** `getPublishedThings()` has no `status` filter and relies on RLS alone. The R1 DDL's `things_read_archived` policy therefore pushed 436 archived rows into the public pool, taking evergreen places (tier 2 and 3) to zero and dropping Lighthouse performance on `/` from 66 to 34. W1.2 must add an explicit `.eq("status", "published")`, which the spec assumed was already there. Same applies to `getNearbyThings()`.
- `getThing()` / `fetchThing()` also has no status filter, so archived detail pages already resolve. W2.2 wants that, but it is currently accidental rather than intended. W2.2 should make it explicit and add the banner.
- The index's "597-test suite" figure is stale. Real count is 864.
