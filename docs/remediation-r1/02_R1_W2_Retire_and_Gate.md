# R1 Wave 2: Retire the Dead, Gate the Pick

Purpose: archive events that already happened so the catalog stops overflowing; give the day's pick real eligibility; keep civic meetings out of a leisure feed; fix the two smaller trust leaks (nearby list repeats, the stuck "Gray day move" label). Requires the Wave 2 DDL and a verified Wave 1.

Findings closed: TP-A1-09, EXP-001, EXP-004, DET-001, DET-003, DET-004, DET-014, EXP-007, EXP-010, EXP-017, DSC-007 (past part), SHR-002 (past marking), OPP-001, TP-A7-05, TP-A7-06, TP-A8-01 to TP-A8-09, TP-C8-03.

Decisions in force: D2, D3, D14.

## W2.1 Retirement step in the pipeline (ingest/retire.ts, called from ingest/run.ts)

- Rule: an event whose `coalesce(ends_at, starts_at + 4h)` is more than 7 days in the past moves `status` to `archived` and sets `archived_at = now()`. Evergreen and recurring rows (starts_at null) are never touched. Rows with a pending `thing_edits` overlay are skipped and logged.
- Each run writes one `audit_log` row per batch with the count (actor: "pipeline", action: "archive_past").
- CP1: run dry-run first, print counts by month and the first 20 titles, stop and wait for Jim's go. Then run for real. Expect roughly 1,100 rows.
- The read-time predicate from W1.2 stays; the two together mean the pool is correct on the day an event ends and the table is tidy a week later.
- Re-ingest safety: the uuid5 id means an archived event that reappears in a source stays archived. Confirm `dedupe.ts` treats archived as "known, do not republish" and add that check if missing.

## W2.2 Archived detail pages stay reachable (app/(app)/thing/[id]/page.tsx)

- `getThing(id)` returns published or archived rows. Archived pages render with a banner at the top: "This already happened on [Weekday, Month D, YYYY]. Here is what else is on." with a link to /. The save heart still works (been-marking). `robots: noindex` on archived pages.
- Print the year on every detail page date line when the date is not in the current calendar month (DET-001).
- "Verified [month year]" stamps render only when `last_confirmed` is within 90 days; otherwise hide the stamp (DET-014).
- Share and restore recipient pages mark past items with the same "already happened" line (SHR-002 past part).

## W2.3 Civic flag (ingest adapters, lib/things.ts, search)

- Add `is_civic: true` at the adapter level for `calendar.santabarbaraca.gov` rows and for any row whose title matches a maintained list in `ingest/civic.ts` (council, commission, board, hearing, agenda, forum with a district number, "consent" as an agenda word). The list is data, editable without a code change to the matcher.
- One-time backfill: set `is_civic = true` on existing rows by the same rules. No checkpoint; include the counts in the run summary (expect about 260 city-calendar rows plus a handful from independent.com).
- The public pool (W1.2 predicate), search, and Plan candidates exclude `is_civic = true`. The cockpit queue still shows them so Jim can flip one to non-civic if a real community event is caught.
- "Independence Day - Holiday Observed" style rows: extend the same list with holiday and closure words; these also set `is_civic` (EXP-010).

## W2.4 Pick eligibility (lib/explore.ts pickAutoHero, lib/heroServer.ts, data pass on hero_eligible)

- CP2: dry-run, show counts per rule and 20 examples that would lose eligibility, wait for Jim's go, then apply: `hero_eligible = false` where `is_civic`, or `address is null or address = 'Santa Barbara, Santa Barbara, CA'`, or `blurb` is null or shorter than 40 characters or equals the title, or `photo_source = 'placeholder'` and `happening_tier = 1`. Report counts per rule.
- `pickAutoHero` preferred branch adds: `hero_eligible`, start time not more than 30 minutes in the past, address present. Remove the bare `ordered[0]` fallback. The fallback chain becomes: eligible tier 1 today, then eligible tier 2 occurring today, then the Wave 1 W1.3b evergreen rotation (`pickEvergreenFallback`), then the static Courthouse card. The pick never goes blank under any filter combination (EXP-017): the pick is computed from the horizon slice before Place, Occasion, and Activity filters are applied, and the card says "Nothing matches that exactly today" only when the filtered feed is empty.
- The founder pin path (`hero_pins`) is unchanged and still sponsor-blind.
- Unit tests: a civic row is never picked; an item that started 2 hours ago is never picked; an empty filtered feed still yields a pick.

## W2.5 Eyebrow priority (components/explore/derive.ts heroEyebrow)

- "Gray day move" applies only when the forecast condition is rain, fog, or overcast (not "partly cloudy" or "few clouds"), and only when the pick is indoor. Otherwise the eyebrow follows the existing content-based branches. The weather chip and the eyebrow must agree; add a unit test with the observed "partly cloudy 74" input yielding a non-gray eyebrow.

## W2.6 Nearby list (lib/things.ts getNearbyThings)

- Group by normalized title and keep one row per title (soonest upcoming). Exclude the current id (already done) and any `is_civic` row. Cap at 5.

## W2.7 Cockpit visibility

- The Live catalog gains an Archived filter and an "is civic" chip so Jim can see what the pipeline did. Read-only listing plus the existing edit path; no new write routes.

## Acceptance

1. Dry-run report shown and approved; after the real run, `select count(*) from things where status='published'` is roughly 420 to 450 and no published event ended more than 7 days ago.
2. `/thing/santa-barbara-wine-festival-38th-annual` loads, shows the "already happened on Saturday, June 27, 2026" banner, and its heart still saves.
3. The pick on / is not civic, has an address and a real blurb, and has not already started. Load / with a filter combination that returns nothing: the pick is still present.
4. "Single Family Design Board - Consent", the Youth Council, and the District 6 Forum are absent from /, search, and Plan candidates, and present in the cockpit queue with the civic chip.
5. On a partly cloudy day the eyebrow is not "Gray day move".
6. `/thing/recreation-swim-oak-park-wading-pool` nearby list shows five distinct titles, none matching the page's own.
7. `select count(*) from things where hero_eligible` is materially below the published count, and the per-rule counts were reported.
8. Tests green.

Commit: `feat(r1-w2): archive finished events, civic flag, real pick eligibility, eyebrow and nearby fixes`
