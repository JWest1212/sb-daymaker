# R1 Progress (Claude Code keeps this current)

Branch: remediation-r1 (cut from `main` at `e823ab1`, the production branch)
Current run: C complete (Waves 6, 7, 8)
Current wave: 8 complete, committed; CP5 approved 2026-09-22
Current task: none. R1 complete, pending push (Blocked)

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
- W6.1 filter and horizon state lives in the URL and the SERVER reads it, so a shared link opens on the right view at first paint. `lib/exploreParams.ts` parses `when`, `area`, `occasion` and `activity` with `Object.hasOwn` (the `in` operator let `?area=constructor` through).
- W6.2 six WHEN pills in the locked order, each carrying its date range in its accessible name.
- W6.3/W6.4 one card anatomy across all four horizons; the full-bleed RockTile is retired (small text over a photograph, unmeasurable contrast); series collapse runs before week grouping, so a weekly series meets itself.
- W6.5 no horizontal overflow and no text under 12px at 390, at 320, and at 200% zoom.
- W6.6 search dedupes by series then title, chips events with their date and venues with "Venue", and tolerates a transposition. `withinEdit1` scored the audit's own example, "musuem", as a miss: plain Levenshtein reads a swap of two letters as distance 2. It now counts as one edit, so the query returns both museums and offers "Did you mean museum". The no-results line is sentence case and the overlay is 480px in the column, not full width.
- W6.7 every in-app link emits the slug (the Discover index, the hero share URL, the detail share URL, shared plans, the digest). Every UUID URL with a slug 308s to it, from the page itself rather than from the redirect table. Old slugs and merged duplicates 308 too, via a lookup that only runs on the miss path. Root `app/not-found.tsx` is branded, with header, nav and three ways back; missing things and guides answer a real 404.
- W6.8 the guide "Now" badge reads the server's clock, passed down, instead of `new Date().getHours()` inside a client component. Verified under `TZ=UTC`.
- W6.9 see the performance section below. Accessibility on `/` is 100.
- W6.10 `lens_select` fires for all three lenses, not Occasion alone.
- W6 commit: `feat(r1-w6): url state, six-pill when row, one card anatomy, series cards, phone layout, search, slugs, hydration and load fixes`
- W7.1 the Saved tab badge counts Want to go only, and "N to go, M been" sits under the toggle. The "Did you make it?" card is labelled from the event's own Santa Barbara time ("This morning", "Last night", "On Saturday"); the section hint hides while the card asks, so the prompt appears once. The empty state has "Browse today" and "Read a guide" and the icon-set heart. The recap and the meta description stop promising a map or a memory.
- W7.2 anything undated (evergreen places and recurring regulars) groups under "Places and regulars" with its next-occurrence meta.
- W7.3 /s, /p and /r sit in one frame: the app's wordmark, "A friend's picks from SB Daymaker, what's worth doing in Santa Barbara.", and a persistent "Open SB Daymaker". Past items are marked on every surface by one rule (`isOver`: archived, or a dated event whose end has passed), which closed a week-long gap: a finished event stays published until the retire job archives it seven days later, so the audit's own shared link showed two last-Monday events unmarked.
- W7.4 offline works. See the deviations: the service worker had never been registering. /saved serves its own cached copy and renders the list from the device, with titles remembered at save time; every other page falls back to /offline.
- W7.5 the submit form marks required fields, names every gap inline, focuses the first one, disables during send, and its success copy sets timing. Title and description match the heading.
- W7.6 subscribe validates inline in the site's styling; success keeps the address visible with "Not you? Try another."; a confirmed address gets a short "already on the list" email and the IDENTICAL response.
- W7.7 confirm and restore emails use the digest's template (lib/email/transactional.ts) with a plain-text alternative. The cadence string lives in one place (lib/edition/cadence.ts).
- W7.8 every one of the nine routes has its own og:title, og:image and description (lib/seo/pageMeta.ts, lib/seo/ogCard.tsx, a colocated opengraph-image per route). /digest/sample has a canonical. Guide not-found is titled. Saved and Discover have an h1. Every page has header, main, nav and one footer landmark.
- W7 review: an adversarial review of the whole diff (6 reviewers, 2 skeptics per finding, 96 agents) confirmed 39 findings (about 20 distinct), refuted 4, split 2. All confirmed and split findings were fixed and re-verified in the browser. See "Wave 7 deviations".
- W7 commit: `feat(r1-w7): saved counts and labels, recipient context, offline shell, form validation, branded emails, per-page metadata`
- W8.1 one name per concept from `lib/strings.ts`: doors Area / Occasion / Activity with the spec's sheet titles; detail "Area" and "Nearby in [short area]"; Reset in the empty state and Plan; "Saved" as the page title; "N on your list"; How it works everywhere; Suggest an event or business; newsletter heading "Santa Barbara, twice a week" and one name, "Newsletter"; Title Case category labels with one arts label, "Arts & Culture". Header search now pushes the params Explore reads (it pushed ?place= and ?vibe=, dead since W6.1).
- W8.2 promises audit: the spec's six phrases are gone; "Verified" means `verified_at` only; the guide passport, disabled Been buttons and "MARKED STOPS TURN SAGE" are hidden (marking was never built); the shared plan's "Save this plan" is hidden (no screen lists saved plans); "Quietly building your Santa Barbara", "real hours", "open when it says" and "Sort by what's closest" replaced. Voice and process claims are listed for Jim in FINAL.md rather than rewritten.
- W8.3 the auto-opening modal is replaced by a dismissible strip above the pick; `sbd.tour.v1` is written on close; TourProvider moved to the root layout so every footer offers How it works; the tour labels its card "Example card". Found and fixed: the itineraries gate counted the key's presence, which the plans store writes on every load, so an unclosed strip would have vanished on visit 2. D10: no visit-count code exists.
- W8.4 emoji in tags, Saved, Discover and not-found pages became the icon set (compass, close, plus added; a `rotate` prop for chevrons); the occasion emoji field is gone and the dead `LensSheet` deleted. Dashes: 141 CSS comment dashes purged, the check extended to .css, .js and public/; the normalizer handles en dashes (range to a hyphen, day, month or clock range to "to", separator to a comma), cleaning the 148 live en dashes at render and at write; guide jsonb prose, stop subs, "Right now" notes and photo credits now pass through it; the enrich and cockpit prompts forbid en dashes too.
- W8.5 one public name per guide (`shortGuideTitle` in `mapGuide`: "State Street" on the card, title, og, breadcrumbs and share); eyebrow "Guides"; the index names the next guide and month from an optional `content.upcoming` (no schema change), or shows no notice. "For you" badge became "Theme". The digest masthead is an h1.
- W8.6 WHEN pills carry no counts (already true); the outbound button's long label wraps at 320; the outbound CTA is large text (the token rule); the logo's accessible name contains its visible text. Accessibility 100 on /, /saved, /plan and a listing.
- W8.7 CLAUDE.md v10 to v11 and eight Doc 14 entries written; root CLAUDE.md pointer updated. CP5 approved 2026-09-22.
- W8 commit: `feat(r1-w8): vocabulary module, promises audit, first-visit strip, icons and dash policy, canon v11`
- W4.1 `lib/areas.ts` is the single area vocabulary: 8 areas, one label each, `areaForThing()` resolving neighborhood then nearby_zone, never "other". `lib/doorZones.ts` is now a thin adapter over it; `lib/zones.ts` keeps only the 6-value `nearby_zone` mapping the database still stores.
- W4.2 the Place door FILTERS (`filterByArea`), tile counts come from the module over the corrected pool, zero-count tiles render disabled rather than hidden, and "Show the closest matches" names what it relaxed ("Showing all areas").
- W4.3 Plan's engine was converted to the 8 areas end to end (zone graph, walk clusters, adjacency, parking notes, cluster boost, hard filter, transitions). Saved's Near Me lists the same 8 plus "Anywhere in SB", the button reads "Funk Zone, 2 of 10", the chosen area becomes its own group so the sort is visible, and geolocation falls back after 6 seconds.
- W4.4 CP3 approved. 634 of 919 area-less rows resolved (274 seeded venue, 130 single-venue source, 127 venue dictionary, 103 postcode). Published rows with no area fell from ~500 to 26; only 8 public, live rows remain unplaced, all carrying the literal city placeholder address.
- W4.5 detail pages use the module label on their own Neighborhood line and in the nearby heading; the Natural History Museum and Puesta del Sol resolve to Mission and Riviera; Oak Park resolves to Upper State.
- W4.6 no Near Me on Explore (D11); the stale comment saying otherwise is gone.
- W4 commit: `feat(r1-w4): single area module, place door filters, area backfill, near me and plan consume it`
- W5.1 `ingest/clean.ts` splits "Title | Venue", expands acronyms from an editable map (LOTG becomes "Library on the Go"), calms shouting titles and lifts addresses out of blurbs. Backfill changed 563 rows: zero published titles now contain a pipe or "LOTG", and 532 rows gained a `venue_name` that renders in the card meta line.
- W5.2 `ingest/series.ts` computes `series_key` for every dated row (1,928 written, 940 distinct series, 198 with more than one date), plus a derived cadence sentence. Cross-source dedupe: the audit's 6 groups were already resolved by Wave 2's archiving; one same-source triple (42nd Annual Vintners Festival) was found and reduced to one published row.
- W5.3 `ingest/blurbRules.ts` states the blurb rules as testable functions and the enrich prompt now carries them as hard rules. Defective output (repeats the title, names the wrong weekday, contains an address, uses a banned phrase) is rejected at landing and logged; the row keeps its existing copy.
- W5.4/W5.5 cards read `blurb`, detail reads `blurb_long ?? blurb`; one `priceLabel()` rule shared by card and detail, `price_note` preferred over the band, never blank, with a "$ under 15" key on the detail page.
- W5.6 outbound buttons name their destination ("Tickets at Ticketmaster", "Event details at sbplibrary.org") and a free row never says tickets.
- W5.7 card and detail photographs carry real alt text (title plus venue); the skyline and generated motifs stay `alt=""`.
- W5.8 the digest sample renders the coming send window only, uses the module's area labels, and has a real title and description.
- W5.9 guides: the Funk Zone block count agrees in both places, each guide has its own walk line, the stale July "Right now" note is hidden past 45 days, and the deliberate-error line is retired (D13).
- W5 extra: D9 enforced. All 27 source files carrying an en dash were corrected (hyphen in a numeric range, "to" in prose), the guide content in the database was corrected, and `scripts/check-emdash.mjs` now fails on U+2013 as well as U+2014.
- W5 commit: `feat(r1-w5): title cleaning, series keys, enrich rules, price notes, alt text, digest from live data, guide copy`

## Checkpoints
- CP1 archive dry-run: approved 2026-09-21
- CP2 hero_eligible pass: approved 2026-09-22
- CP3 area backfill: approved 2026-09-22
- CP4 card rebuild: approved 2026-09-22
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

### Wave 8 deviations and decisions

- **En dashes that separate become a comma, not "to".** D9 says "to" in prose, but the live title "The Lost Weekend [en dash] The Photography of May Pang" would read "The Lost Weekend to The Photography...". "to" is kept for real ranges (days, months, clock times); digit ranges keep a hyphen.
- **`guides.upcoming` lives in the guides' existing `content` jsonb**, because the index allows no DDL beyond the one block. The cockpit has no guide editor, so "Jim can edit it in the cockpit" is not built; it is edited in the Supabase table editor (recorded in canon §10).
- **The tour teaches on a labeled example**, the spec's stated fallback, rather than the real pick; the SVG card cannot take arbitrary pick data without a redesign of panel 1.
- **"Places and regulars" keeps the word "Places"**: W7.2 names that label verbatim, and it is the thing-type sense, not the retired where-concept.
- **Canon decisions made at CP5 for Jim to confirm**: the R1 ledger now outranks older docs; the Gate 4 Concierge Day is the Plan spec; the v10 note is replaced by the v11 note (its history is in Doc 14); Doc 14 headings use " · " instead of an em dash; old canon sentences keep their em dashes (only new text is dash-free); START_HERE.md and 00_Project_Context.md banners are not updated; `Core Project Files/sbdaymaker_tokens.css` is not synced to the app copy (they already differed before R1).

### Wave 7 deviations and findings

- **The offline worker had never been installing.** It registered on the window `load` event from inside an effect, and on most visits `load` has already fired by then, so the listener waited for an event that never came. Measured: zero registrations five seconds after loading the homepage. That, not the worker's routing, is the real cause of TP-C3-03 and TP-C3-04. It now registers immediately when the page has finished loading.
- **A dropped connection used to read as "these saves no longer exist".** Supabase's client never throws on a network failure; it resolves with an error, and `getThingsByIds` turned that into an empty answer, so on a flaky connection /saved would have labelled every save "No longer listed". Nothing was ever deleted (W1.1 holds), but the words were wrong. It now throws `ThingsUnreachableError`, and the page says "You're offline" or "We couldn't reach SB Daymaker just now" and retries: on reconnect, on returning to the tab, and on a 10 s to 2 min backoff.
- **Subscribe no longer reveals who is subscribed, even to the API.** The page already showed one message, but the API answered `status: "already"` and sent nothing, so anyone could POST an address and learn whether it was on the list. A confirmed address now gets a short "you're already on the list" note and the same response as a first-time signup. The `subscribe_submit` analytics event therefore always reports "pending"; the old "already" count is gone by design.
- **robots.txt: /p/ added for search crawlers, link-preview bots let in.** META-003 asked for /p/ in the disallow list, but X, Slack, LinkedIn and the other unfurlers honour robots.txt, so a blanket disallow meant a shared plan or list showed no preview card at all, defeating META-001 on the pages people actually share. Search crawlers are still kept out of /s/, /p/ and /r/, which also carry noindex; the unfurlers get their own rule.
- **Explore's footer is now the shared footer.** Explore's old footer sat inside `<main>`, so it was not a footer landmark, and /weekend (the same component) showed the new shared footer's links twice. The signup block stays with the feed as a section; the trust line, Suggest and How it works are in the one footer every page renders.
- **Dead listing and guide URLs render client-side.** They answer a correct 404, but in this Next version a thrown `notFound()` escapes server rendering, so the page body is drawn in the browser. With JavaScript it is right (title, copy, landmarks, h1); with JavaScript off it is blank. The alternatives are a 200 (soft 404, keeps dead listings indexable) or a database check in the proxy on every listing view. Kept the 404; reversing it is a two-line change.
- **The dash check now fails the build.** It existed but only `npm run lint` ran it. `next.config.ts` runs it in the production-build phase, so `next build` fails on a U+2014 or U+2013 however it is started (proved with a planted dash). This is W8.4 work done early. CSS is not scanned yet: app/components.css carries 108 pre-R1 em dashes in comments, which W8.4 purges before extending the check.
- **Gmail rendering (acceptance line 8) is Jim's to eyeball.** The template renders correctly in a browser at 390 and 700px (evidence/w7-email-confirm-*.png); the Gmail connector is not authorized in this session.

### Wave 6 deviations and findings

- **DET-007's "drop the hash when the slug is already unique" does not apply to a single live row.** The shortening pass is built and tested, and it reports zero. The audit's own example, `/thing/baby-and-me-808c`, keeps its hash because `baby-and-me` is genuinely held by another row: the archived "Baby & Me". The bare slug is not free, so dropping the hash would collide.
- **Three real bugs in the slug backfill, found by running it.** It had never finished its job. (1) The row select and the taken-slug select were both unpaged, so they stopped at PostgREST's 1,000-row ceiling and the sweep reported success while leaving the rest of the catalog unslugged. That is why UUID URLs kept appearing in the feed long after the backfill had "run", and it is the real cause of DET-007's "two other UUIDs do not redirect". (2) The taken-set was seeded only from published and archived rows, but `things_slug_uidx` is table-wide, so a slug held by a draft or rejected row was reported free and the write then failed. (3) A single failed row aborted the whole sweep. After the fixes: **106 further rows slugged, 0 public rows now without a slug, 2,018 redirect rows.**
- **The 308 no longer depends on the redirect table.** Both detail pages redirect a UUID to the slug themselves, so a row that has a slug always redirects whether or not a `url_redirects` entry exists. The proxy's table lookup stays as the fast path and now answers 308 rather than 301, so the two paths agree.
- **Missing things and guides now answer 404, not 200.** The words were already right; the status was not, and a "Not found" page served with 200 tells a crawler a dead listing is healthy. The copy moved into each segment's `not-found.tsx`.
- **`lens_select` carries a `dimension` alongside the key, against W6.10's "the key only".** The key alone is ambiguous: `nightlife` is both an Occasion and an Activity, so without the dimension those two taps are one row in the report. It is a three-value enum, not content, so it stays inside the props policy.
- **The guide hydration error could not be reproduced locally**, because this machine's server and browser share a timezone, which is exactly the condition that hides it. Proven instead by running the server under `TZ=UTC`, as Vercel does: at 13:30 Santa Barbara time the UTC server badges the **Afternoon** chapter, not the Golden one its own 20:30 clock would suggest. Zero hydration errors on both guides.

### Wave 6 performance, and the one acceptance line not met

Acceptance line 10 asks for Lighthouse mobile LCP on `/` under 4 seconds. **It is 8.3 s** (baseline 16.0 s). All three remedies the spec names are applied:

- **Defer the feed below the fold.** The two collapsed accordions kept their cards in the DOM via `hidden`, so the browser fetched their photographs on arrival. The homepage was loading **69 images and 53 of them belonged to sections nobody had opened**. Now 16. LCP 13.5 s -> 8.9 s.
- **Cut the per-row select.** `stripForBrowse()` drops the eight fields no browse card reads before the pool is serialized. 935 KB -> 848 KB.
- **Stream the hero first.** The hero SVG asks for the connection with `fetchPriority="high"`; card photographs ask with `fetchPriority="low"`.

**Payload size is not what is holding the number.** Capping the pool at 60 rows as an experiment took the document from 848 KB to 234 KB, a 72 percent cut, and LCP did not move (8.7 s). Meanwhile a real browser under emulated slow 4G and 4x CPU throttling paints the LCP element, the hero SVG, at **1.2 s**, and the hero tag sits at byte 319 with a preload already in the head. Lighthouse reports `lcpLoadDelay: 6,976 ms` for a local file a throttled browser fetches immediately, and its `largest-contentful-paint-element` audit returns nothing at all. The gap is in Lighthouse's Lantern simulation against localhost, not in what a visitor waits for. **The honest next measurement is against the deployed preview**, which is blocked on the push (see below); production serves that hero from a CDN, which is the leg Lantern is modelling worst.

Two accessibility failures were fixed on the way and **Lighthouse accessibility on `/` is now 100** (was 93): the Build-a-day sub-line was white at 85 percent opacity over terracotta (3.8:1, under the 4.5:1 floor) and the tour dots were 7px buttons whose 44px hit area lived in a pseudo-element no audit tool can see.

### Wave 5 deviations and carry-overs

- **`series_key` is title + venue, without the weekday.** W5.2's prose says to include the weekday; its own acceptance line says Recreation Swim should have two keys, one per pool. Both cannot be true: with the weekday, Recreation Swim produced 18 keys and the Arts and Crafts Show (which runs Saturday and Sunday) split in two. Title + venue gives the Arts and Crafts Show one key and Recreation Swim three, one per pool (the audit said two; the data has three). The cadence sentence is derived from the occurrence dates instead, which is more accurate and can say "Most days".
- **A short blurb is not treated as a defect.** W5.3 lists "shorter than 40 characters" among the blurb rules. Enforced literally it rejects "Golden-hour guitars by the water." (33 characters), which is better writing than most long blurbs. Length is used to CHOOSE which rows to re-enrich, which is what the spec wants it for; only unambiguous errors (repeats the title, wrong weekday, street address, banned phrase) block output.
- **Cross-source dedupe found nothing left to do.** The audit's 6 groups were past events that Wave 2 archived. One same-source triple remained and was reduced.
- **Carried into Run C, not done here:** the AI re-enrichment run itself (14 published rows have a blurb under 40 characters or equal to their title, and 4 name the wrong weekday; the rules and validators are in place, the batch run is not), and W5.7's image waterfall change plus re-resolving events currently on a Wikimedia photo. Both are pipeline runs rather than code, and neither blocks Run C's screen work.

### Wave 4 deviations

- **No paid geocoding step.** W4.4 allows a Google Places geocode from the address as rule 3. Measured against the real data it would buy almost nothing: rows with a usable address nearly always have coordinates already, and the ones that do not carry the city-wide placeholder "Santa Barbara, Santa Barbara, CA", which geocodes to the middle of town and would invent an area rather than find one. Two cheaper, honest rules were added instead, both from the actual data: the source's own venue for single-venue sources (a brewery's calendar only publishes events at that brewery), and unambiguous postcodes (93103 is the Eastside, 93117 is Goleta; 93101 is deliberately absent because it covers Downtown, the Funk Zone and the Waterfront alike).
- **285 rows remain unresolved, against the spec's "under 100".** 259 are archived, 10 are civic (never in the feed), 8 are published but already over. Eight are public and live, all with the placeholder address. Reported at CP3 and approved.
- **The seeded venue table takes precedence over the automatic resolver.** W4.4 lists it as rule 1, and it has to outrank the bounding boxes: those were putting the Sunday Arts and Crafts Show on Cabrillo Boulevard in the Funk Zone rather than on the Waterfront. The street table also now matches spelled-out street types ("Cabrillo Boulevard" as well as "Cabrillo Blvd"), which was the underlying cause.
- **Near Me needed a grouping change, not just a sort.** Saved groups by type, so bubbling area matches to the front of the array scattered them straight back through Events and Places and the visitor saw nothing move. The chosen area now becomes its own group at the top ("In Funk Zone"), which is a visible answer that also says what it is answering.
- **Two venue assignments are judgement calls**, flagged `review: true` in `ingest/data/venues.json`: Oak Park (between Upper State and The Mesa; W4.5 asked for one to be chosen) and Arroyo Burro Open Space.

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
