# R1 Baseline

Recorded 2026-09-21 before any Wave 1 code changed.
Branch: `remediation-r1`, cut from **`main`** at `e823ab1` ("Merge pull request #20 from JWest1212/elevation-v1-gate4-5"), which is the production branch. Its tree is identical to `elevation-v1-gate4-5` at `01e2467`, the commit the technical pass audited.

## R1 DDL verification (index "single DDL paste")

| Item | Result |
|---|---|
| `things.is_civic` | present |
| `things.archived_at` | present |
| `things.series_key` | present |
| `things.venue_name` | present |
| `things.price_note` | present |
| anon can select `status = 'archived'` | yes, 487 rows readable with the anon key |
| anon can select `status = 'needs_review'` | no, 0 of 6 rows (policy is correctly scoped) |
| `things_pool_idx`, `things_series_idx` | not verifiable through PostgREST; both are `if not exists` and performance-only, so not a blocker |

The DDL landed. Nothing needs pasting.

## Test suite

| | Count |
|---|---|
| Test files | 59 |
| Tests | 864 |
| Failing at baseline | 1, now fixed (see below) |

The index's "597-test suite" figure is out of date. The real suite is **864 tests in 59 files**, and it is green.

Two environment repairs were needed before the suite could run at all. Both are recorded under "Environment repairs" below.

## Live data, measured today with the anon key

| Measure | Value |
|---|---|
| `things` rows with `status = 'published'` | **1,529** |
| `things` rows with `status = 'archived'` | 487 |
| Rows anon can see in total | 2,016 |
| Rows the API returns to `getPublishedThings()` | **1,000** (the PostgREST ceiling) |
| Rows `getPublishedThings()` renders after the `quality_tier !== 3` drop | **998** |
| Rows missing from the pool | **1,016** |
| `happening_tier = 2` rows in the published table / in the pool | 18 / **0** |
| `happening_tier = 3` rows in the published table / in the pool | 54 / **0** |
| Evergreen rows (`starts_at` null) in the pool | **0** |
| Rows in the pool whose event already finished | **745 of 998 (75%)** |
| Archived rows leaking into the public pool | **436** |
| `hero_eligible = true` among published rows | 1,529 of 1,529 (the flag gates nothing) |
| `is_civic = true` among published rows | 0 (column exists, never populated) |

### The baseline is worse than the audit measured, and the DDL paste is why

The audit (TP-A1-03) measured 533 published things outside the pool. Today it is 1,016, and the extra loss is a direct side effect of the R1 DDL:

`getPublishedThings()` in `lib/things.ts:195-215` has **no `status` filter at all**. It has always relied entirely on RLS to decide what "published" means. The new `things_read_archived` policy grants the anon role SELECT on archived rows, so archived rows now flow through that unfiltered query into every public surface.

The measured effect on the live site right now:

- 436 of the 998 rows the homepage renders are **archived** items that were deliberately retired (for example "LOTG | Shoreline Park", "Recreation Swim | Oak Park Wading Pool", "Baby & Me").
- Those 436 rows consume 436 slots of the 1,000-row budget, which pushed the pool from "all tier 1" to "all tier 1 with even less room". Tier 2 and tier 3 are now at **zero**, so every evergreen place is invisible.
- Lighthouse performance on `/` fell from 66 to **34** and TBT from 70 ms to 1,220 ms, consistent with the larger payload.

This is not a reason to undo the policy. The policy is required by D2 so saved and shared links can still render items that already happened. The fix is the one W1.2 was already going to make, plus an explicit `status` predicate that the spec did not call out because it assumed the query had one: **`getPublishedThings()` must filter `status = 'published'` itself rather than trusting RLS.** That is task W1.2 and it is the first thing built.

## Performance, production, Lighthouse 13 mobile preset (390x844, DPR 2)

| Metric | Baseline | Audit, 2026-09-21 earlier |
|---|---|---|
| Performance | **34** | 66 |
| Accessibility | 93 | 93 |
| **LCP** | **16.0 s** | 15.8 s |
| CLS | 0.015 | 0 |
| TBT | 1,220 ms | 70 ms |
| FCP | 3.7 s | 2.4 s |
| Speed Index | 11.4 s | 6.3 s |

## Homepage at 390px

`docs/remediation-r1/baseline/home-390.png`, captured against production in a fresh mobile context with the welcome modal dismissed.

- Horizontal overflow at 390px: **14 px** (TP-C1-01 reproduces).
- Today's pick at capture time: **"Single Family Design Board - Consent"**, a municipal design-review hearing (TP-A8-08 still live).

## Environment repairs made before the baseline could be taken

Neither changes application behavior. Both are recorded here because they are real changes to the repo.

1. **`node_modules` was destroyed by iCloud sync.** This repo lives in `~/Documents`, which iCloud syncs. 27,849 files inside `node_modules` had been evicted to the cloud ("dataless"), with 1,364 sync-conflict duplicates such as `package 2.json`. Node's module resolver blocked forever in a synchronous `pread` on an evicted `package.json`, so `npm test`, `npx vitest --version` and anything else that loads a dependency hung with no output and no error.
   Fix: dependencies now install into `node_modules.nosync/` (iCloud skips any name ending in `.nosync`) with `node_modules` as a symlink to it, the same trick this project already uses for `.next.nosync`. `node_modules.nosync` is gitignored.
2. **`vitest.config.ts` needed an explicit exclude.** Vitest's default ignore list only knows the literal `node_modules`, so after the rename it began collecting third-party tests from inside the dependency tree (26 failing suites that are not this project's code). Added `exclude: [...configDefaults.exclude, "**/node_modules.nosync/**"]`.

## The one pre-existing test failure, and its fix

`ingest/adapters/generic.test.ts:46` "marks a fully-dated event ai_extracted with a deterministic start" was failing on the production branch before any R1 work.

It is a bug in the test, not in the code. The test hardcodes `start_date: '2026-07-24'` but calls `toRawCandidate(...)` without the `now` argument, so `now` defaults to the real clock. Once the real date passed 2026-07-24, `isPastDate()` correctly treated the start as stale and returned `startStrategy: 'none'`. The production behavior is right: that guard is the trust firewall that stops a cached page landing a wrong-year date.

Every other dated case in the same file injects a fixed clock. The fix makes this one match: `toRawCandidate(e, sourceRow, sourceRow.url, new Date('2026-07-17T12:00:00-07:00'))`. No production code changed.
