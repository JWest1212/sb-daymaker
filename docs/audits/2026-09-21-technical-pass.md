# SB Daymaker - Technical Audit Pass

Date: 2026-09-21 (Pacific)
Mode: read-only investigation. No application code, data, content, schema, or configuration was changed.
Scope: live production site https://www.sbdaymaker.com plus this repo at branch `elevation-v1-gate4-5`, commit `01e2467`.

## Plain-language summary

The site is quietly throwing away saves, and I reproduced it on the live site: I saved two real things, opened the Saved page, and both were gone within seconds. The cause is that Santa Barbara now has 1,529 published listings but the database only hands back 1,000 at a time, so about a third of the catalogue is invisible to the site, and the Saved page treats anything it cannot see as deleted and wipes it off the user's phone. That cut falls entirely on the evergreen places, which is why every one of the 16 hearts in the Discover SB guides erases itself. The reason the catalogue grew past the limit is that 1,108 of those 1,529 listings are events from June, July and August that were never retired, and the same dead weight is why today's front-page pick was a municipal design-review hearing and why a test plan for a couple on foot returned a single stop at a food bank. Everything else I found (the neighbourhood filter on Explore that only re-sorts, the homepage that scrolls sideways on a phone and takes 15.8 seconds to show its main content, the duplicate listings that are really repeat sessions of the same weekly event) is smaller, and several things the earlier audit flagged turned out to be working correctly.

## How to read a finding line

`ID | route or file | what was checked | what was found | evidence | severity S1-S5 | confidence`

---

## Section A: hypotheses

### A1. Saves vanish (SAV-001)

**Verdict: CONFIRMED, and the cause is bigger than the hypothesis.**

The ghost-save cleanup does exactly what the hypothesis said, but the pool it is handed
is silently truncated to 1,000 rows by the database, so it deletes far more than stale ids.

TP-A1-01 | components/saved/SavedClient.tsx:76-81 | whether the ghost-save cleanup deletes saved ids missing from the pool | It does. `for (const id of ids) if (!live.has(id)) remove(id)` deletes any saved id absent from the `things` prop. There is no grace period, no "unknown" state, and no user-visible notice. The only guard is `things.length === 0 \|\| things.length >= 1000` | components/saved/SavedClient.tsx:76-81 | S1 | Verified
TP-A1-02 | lib/things.ts:195-215 | what the pool includes and excludes | `getPublishedThings()` runs `select(...).order("happening_tier", asc)` with NO `.limit()` and NO date filter, then drops `quality_tier === 3`. It does not exclude past-dated events. It does exclude, by accident, everything past PostgREST's 1,000-row ceiling | lib/things.ts:201-214 | S1 | Verified
TP-A1-03 | Supabase `things` | the real size of the published catalog vs what the pool returns | 1,529 rows have `status = published`. The API returns exactly 1,000 (`content-range: 0-999/1529`). 529 published things, 35% of the catalog, are invisible to every public surface that reads through `getPublishedThings()`: Explore, Saved, Plan, Discover, share, search | `GET /rest/v1/things?select=id&status=eq.published` returns `content-range: 0-999/1529` with the anon key; `qAll` pagination returns 1,529 | S1 | Verified
TP-A1-04 | lib/things.ts:201 + components/saved/SavedClient.tsx:78 | whether the 1,000-row guard actually fires | It does not. The 1,000 rows contain 4 rows with `quality_tier = 3`, so after the filter the array is **996**, which is `< 1000`. The guard is bypassed and the cleanup runs against a pool missing 533 published things | measured: quality_tier histogram inside the 1,000 = `{1: 14, 2: 982, 3: 4}` -> pool length 996; guard `>= 1000` evaluates false | S1 | Verified
TP-A1-05 | lib/things.ts:201 | which 1,000 rows survive the cut | The sort key is `happening_tier` and **all 1,000 returned rows are `happening_tier = 1`**. Published tier counts are tier1 = 1,457, tier2 = 18, tier3 = 54. Because 1,457 tier-1 rows already exceed the ceiling, **no `happening_tier` 2 or 3 row is ever served to the public**. Those 72 rows are the evergreen places (all 72 have `starts_at = null`) | measured happening_tier histogram inside the 1,000 = `{1: 1000}`; `status=eq.published&happening_tier=eq.2` -> count 18, `=eq.3` -> count 54 | S1 | Verified
TP-A1-06 | Funk Zone guide -> /saved | the specific named item | **Helena Avenue Bakery** is `happening_tier = 3`, `quality_tier = 1`, `starts_at = null`. Simulating the pool exactly (order by happening_tier asc, take 1,000, drop quality_tier 3) puts it **outside the pool**. Saving it from the guide and then opening /saved deletes the save | id `8e309567-4ee0-5324-894c-7b0d8d664724`; simulation script `~/sbd-audit-scratch/named.mjs` prints `IN PUBLIC POOL: false` | S1 | Verified
TP-A1-07 | lib/guides.ts:130-157 | why a guide can save something /saved cannot see | `getStopThingMap()` fetches stop things by `.in("id", ids)` with **no `quality_tier` filter, no `happening_tier` ordering and no row ceiling**. A guide therefore renders and offers a heart on things the /saved pool structurally cannot contain. The heart writes `stop.thing_id` (components/discover/GuideWalkSection.tsx:99) | lib/guides.ts:138-141; components/discover/GuideWalkSection.tsx:50,99 | S1 | Verified
TP-A1-08 | /thing/[id] -> /saved | the second named item | **Santa Barbara Wine Festival** is `happening_tier = 1`, so it IS inside the pool and survives the cleanup, even though it is past-dated (starts 2026-06-27). Past-dating alone does not delete a save | id `27c661ff-efcc-5dea-bccd-db53df499980`; simulation prints `IN PUBLIC POOL: true` | S3 | Verified
TP-A1-09 | Supabase `things` | why the ceiling is being hit at all | 1,108 of the 1,529 published rows (72.5%) are **past-dated events that were never unpublished or archived** (June 35, July 420, August 401, September 252). Dead events are consuming the entire 1,000-row public budget and pushing every evergreen place out | `~/sbd-audit-scratch/past.mjs` | S1 | Verified

**The chain in one line:** past events are never retired -> the published catalog grew to 1,529 -> the API ceiling cuts it to 1,000 -> the cut lands entirely inside `happening_tier = 1`, so all 72 evergreen places fall out -> /saved sees a 996-row pool, decides anything not in it no longer exists, and deletes it from the user's device.

### A2. Areas are ignored (EXP-002, EXP-003, EXP-038, PLN-006, SAV-006)

**Verdict: CONFIRMED.** There are two different area systems over two different database
columns, and the one users meet first on Explore is a re-order, not a filter.

TP-A2-01 | lib/zones.ts:5-25 | the keys the Saved Near Me sheet and the Plan area step send | Six keys from `lib/zones.ts`: `funk, downtown, waterfront, montecito, mesa, goleta`, plus an "Anywhere in SB" null. Both surfaces match them against the `things.nearby_zone` column | lib/zones.ts:5, components/explore/NearMeSheet.tsx:62-71, lib/plan/types.ts:117 | S3 | Verified
TP-A2-02 | lib/doorZones.ts:12-37 | the keys the Explore Place door sends | Eight **different** keys from `lib/doorZones.ts`: `downtown_state, funk_zone, waterfront_harbor, mesa, mission_riviera, uptown_upper_state, goleta_isla_vista, montecito_carpinteria`. They are derived at read time from the `things.neighborhood` column, not `nearby_zone`. The file says so itself: "Distinct from lib/zones.ts's 6-value nearby_zone" | lib/doorZones.ts:5-7, 12-37; lib/tiles.ts:19-28 | S3 | Verified
TP-A2-03 | components/explore/ExploreClient.tsx:113 | whether the Explore Place door filters or only reorders | **It only reorders.** Line 113 is `return sortByDoorZone(cascade(activityFiltered), place)`. Vibe and Activity are real filters (`filterByLens`, `filterByActivity`); Place is passed to a stable sort that bubbles matches to the top and keeps everything else. `sortByDoorZone` is explicitly documented as "a sort, not a filter" | components/explore/ExploreClient.tsx:113, 177; lib/doorZones.ts:69-83 | S2 | Verified
TP-A2-04 | components/explore/DiscoveryDoors.tsx:9-13 + ExploreClient.tsx:151 | whether the UI tells the user it is only a sort | No. The door's accessible name is "Filter by place", and choosing one adds a removable filter chip in the same row as the Vibe and Activity chips, which do filter. Nothing on screen distinguishes the sort from the two filters | components/explore/DiscoveryDoors.tsx:12 (`ariaLabel: "Filter by place"`), ExploreClient.tsx:151 | S2 | Verified
TP-A2-05 | components/saved/SavedClient.tsx:100 + lib/explore.ts:212-222 | what Saved Near Me does | Also a re-order. `nearMeSort` bubbles rows whose `nearby_zone` equals the chosen zone and keeps the rest in place. Nothing is removed, so with a short list the change can be invisible | lib/explore.ts:212-222 | S3 | Verified
TP-A2-06 | lib/plan/hardFilter.ts:117-129 | what the Plan area step does | The only genuine area **filter** of the three, but it is conditional: `if (anchorZone && t.nearby_zone)`. A candidate with no `nearby_zone` is never excluded, by design ("unknown zone is not a violation"). Car transport skips the check entirely | lib/plan/hardFilter.ts:118-129 | S3 | Verified
TP-A2-07 | Supabase `things` | distinct `nearby_zone` values across published things, with counts | `downtown` 709 (46.4%), **`(null)` 585 (38.3%)**, `montecito` 154 (10.1%), `funk` 27 (1.8%), `goleta` 20 (1.3%), `mesa` 19 (1.2%), `waterfront` 15 (1.0%) | `~/sbd-audit-scratch/a2.mjs`, over all 1,529 published rows | S2 | Verified
TP-A2-08 | Supabase `things` | published things with no area, or an area the UI never offers | **585 of 1,529 (38.3%)** have `nearby_zone = null`, so the Near Me sort and the Plan area filter can never match them. **610 of 1,529 (39.9%)** have no Place door zone (`neighborhood` null or `other`), so the Explore Place door can never bubble them. **Zero** published rows store a `nearby_zone` value the UI does not offer, so the mismatch is missing data, not bad keys | `~/sbd-audit-scratch/a2.mjs` | S2 | Verified
TP-A2-09 | Supabase `things` | how many of the area-less rows arrived in the Sep 21 update | **67 of the 136** rows in the 12:10-12:13 PM update batch have `nearby_zone = null`, 49% of the batch. The update made the area coverage worse, not better | `~/sbd-audit-scratch/named.mjs` batch tally: `{"(null)":67,"downtown":57,"montecito":12}` | S2 | Verified
TP-A2-10 | lib/zones.ts:31-43 vs lib/doorZones.ts:28-37 | whether the two taxonomies agree where both are populated | Largely yes. Only **16** published rows disagree, and 25 have exactly one of the two fields populated. The 585 rows where both are unknown are the real problem | `~/sbd-audit-scratch/a2.mjs` | S4 | Verified
TP-A2-11 | lib/tiles.ts:23-29 | what the Place door tile counts are computed over | `placeTiles(inHorizon)` counts against the in-horizon slice of the pool, and the pool is the truncated 996 rows from TP-A1-03. Every door count is therefore computed over about two thirds of the catalog | lib/tiles.ts:23-28, lib/things.ts:201 | S2 | Verified

**Live production reproduction (the decisive evidence for A1):**

In a fresh Playwright context on www.sbdaymaker.com I saved the Santa Barbara Wine Festival
from its detail page and Helena Avenue Bakery from the Funk Zone guide, then opened /saved.

```
  BEFORE /saved : {"27c661ff-...-db53df499980":"want","8e309567-...-d8b0664724":"want"}
  AFTER  /saved : {}
  REMOVED       : both ids
  screen         : "Nothing saved yet. Tap the heart on anything you love..."
```

TP-A1-10 | production /saved | end-to-end reproduction | **Both saves were deleted.** `sbd.saves.v1` went from two ids to `{}` in the time it took /saved to hydrate, and the page showed the never-saved-anything empty state. Neither id appears in the production /saved payload | `~/sbd-audit-scratch/a1-live.mjs`; `curl /saved \| grep <id>` returns 0 for both; screenshot `~/sbd-audit-scratch/shots/a1-saved.png` | S1 | Verified
TP-A1-11 | Supabase `things` vs the live pool | the blast radius | **533 of 1,529 published things (35%) are outside the pool.** Saving any one of them and opening /saved deletes the save. By tier: 461 are `happening_tier` 1, 18 are tier 2, 54 are tier 3 | `~/sbd-audit-scratch` pool-membership diff against the live anon query | S1 | Verified
TP-A1-12 | guide_stops | how the Discover guides are affected | **All 16 thing-backed guide stops across both published guides are outside the pool**: Pali Wine Co., MOXI, Topa Topa Brewing Co., Paloma, Caje, The Lark, El Presidio de Santa Barbara, La Arcada Courtyard, Palihouse, Santa Barbara Wine Collective, Helena Avenue Bakery, Santa Barbara Public Market, Santa Barbara County Courthouse, Lucky Penny, The Arlington Theatre, The Book Den. Every heart in Discover SB deletes itself | pool-membership join over `guide_stops.thing_id` | S1 | Verified

### A3. Cache staleness after an update

**Verdict: CONFIRMED as a code and cache-header fact.** I could not trigger a content change
without writing data, so this is proved from the code paths and the live headers, as instructed.

TP-A3-01 | app/(app)/saved, plan, discover, thing | whether ISR windows are still in place while / renders fresh | Yes. `/` and `/weekend` are `export const dynamic = "force-dynamic"`; `/saved`, `/plan`, `/discover`, `/discover/[id]` and `/thing/[id]` all declare `export const revalidate = 600` | app/(app)/page.tsx:9, app/(app)/weekend/page.tsx:13, app/(app)/saved/page.tsx:11, app/plan/page.tsx:11, app/(app)/discover/page.tsx:12, app/(app)/thing/[id]/page.tsx:20 | S2 | Verified
TP-A3-02 | production response headers | what the CDN actually serves | `/saved`, `/plan`, `/discover` return `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, with observed `age` of 149-169s. `/` and `/weekend` return `x-vercel-cache: MISS`, `private, no-cache, no-store` | `curl -sI` on each route, run 2026-09-21 | S2 | Verified
TP-A3-03 | app/(app)/thing/[id]/page.tsx:20 | a declared-vs-actual mismatch | The detail route declares `revalidate = 600` but production serves it `x-vercel-cache: MISS`, `private, no-cache, no-store, must-revalidate`. Something in the render is opting it out of ISR, so every detail view is a fresh server render | `curl -sI /thing/baby-and-me-808c` | S3 | Likely
TP-A3-04 | ingest/ | whether the ingest pipeline revalidates after it writes | **It does not.** No file under `ingest/` calls `revalidatePath`, `revalidateTag` or any purge. After a publish wave, `/saved`, `/plan` and `/discover` keep serving the pre-update pool until their own window lapses | `find ingest -name '*.ts' \| xargs grep -l revalidate` returns only `ingest/audits/emdash_purge.ts`, an unrelated text-cleanup script | S2 | Verified
TP-A3-05 | / vs /saved | the window during which a save can be deleted | `/` is force-dynamic, so a thing published at 12:13 PM is savable from Explore immediately. `/saved` serves its cached pool for up to its revalidate window. A thing saved inside that window is absent from the cached pool, so the TP-A1-01 cleanup deletes it. The Sep 21 update published 136 things between 12:10 and 12:13 PM, squarely inside the audit's Phase 1 to Phase 2 boundary | code paths above + the 136-row update batch | S1 | Likely
TP-A3-06 | - | the live trigger test | **NOT PERFORMED.** Triggering a content change requires an INSERT or UPDATE, which this pass is forbidden to do. Proved from code paths and cache headers instead, per instruction | - | - | Untested by design

### A4. Restore panel (SAV-002)

**Verdict: CONFIRMED as to the rule; the feature itself works correctly.**

TP-A4-01 | components/saved/SavedClient.tsx:388 | when RestorePanel renders | `{counts.total >= 5 ? <RestorePanel /> : null}`. The July rule still holds. Live check: with 4 saves `.sbd-restore` renders 0 times, with 5 saves it renders once | components/saved/SavedClient.tsx:388; `~/sbd-audit-scratch/a46b.mjs` | S3 | Verified
TP-A4-02 | app/api/restore-link/route.ts + production | whether an email is actually sent | **Yes.** One request to jim@sourcewyse.com returned HTTP 200 with `{"ok":true,"token":"9d983a66...","sent":true}`. `sent: true` means Resend accepted it | live POST captured in `~/sbd-audit-scratch/a46b.mjs` | S5 | Verified
TP-A4-03 | components/saved/RestorePanel.tsx:56-60 | what the screen says | "Check your inbox, we sent your restore link. Open it on any device to bring your saves back, or copy it now." plus the raw link and a Copy link button. The `sent: false` path shows the honest "Email isn't set up yet, copy your link instead" copy instead | screenshot `~/sbd-audit-scratch/shots/a4-restore.png` | S5 | Verified
TP-A4-04 | /r/[token] | whether the link works in a fresh context | **Yes.** Opened in a brand-new empty context it renders "Bring your saves back / We found 5 saved items in this backup. / Restore 5 to this device". It correctly does not write to localStorage until the user taps Restore | screenshot `~/sbd-audit-scratch/shots/a4-restored.png` | S5 | Verified
TP-A4-05 | components/saved/SavedClient.tsx:388 | the judgement call behind the rule | The backup offer is hidden from anyone holding 1 to 4 saves. Given A1, those users are losing saves too, and they are the ones with the least reason to suspect it | components/saved/SavedClient.tsx:388 | S3 | Verified

### A5. Been confirmation (SHR-003)

**Verdict: the toast is fine. The count disagreement is real.**

TP-A5-01 | /saved | whether the been toast renders, for how long, with what text | It renders. Text: "✓ Nice, that's 1 SB spot you've made it to." with sub-line "Quietly building your Santa Barbara." It disappeared after ~2,491ms, matching the 2,500ms timer at SavedClient.tsx:70-74 | live run, `~/sbd-audit-scratch/a456.mjs`; screenshot `shots/a5-been-toast.png` | S5 | Verified
TP-A5-02 | /saved bottom tab vs Want toggle | whether the two counts agree | **They do not.** Starting from 6 saves and flipping one to been: the Want to go chip drops to 5 and a Been chip appears reading 1, but the bottom-tab badge stays at **6**. The tab badge counts all saves, want plus been; the toggle counts only want. Nothing on screen explains the difference | before: tab "Explore \| 6 \| Saved", toggle "Want to go 6". after: tab "Explore \| 6 \| Saved", toggle "Want to go 5 / Been 1" | S3 | Verified

### A6. Whole-card tap target (A11Y-001)

**Verdict: the mechanism exists and mostly works. Specific strips of each card are dead.**

TP-A6-01 | app/components.css:5849-5857 | whether a ::after overlay exists | Yes. `.sbd-stretch::after { content:""; position:absolute; inset:0; z-index:1 }`, and `.sbd-card { position: relative }` at line 5845. Live computed styles confirm `position:absolute`, `inset 0px 0px 0px 0px`, `z-index:1` on both the pick card and the feed cards | app/components.css:5844-5857; live `getComputedStyle(el,'::after')` | S4 | Verified
TP-A6-02 | / pick card | measured clickable area | Box 350x330. 4 of 7 probe points resolve to the stretched link (centre, bottom-left, bottom-right, bottom-mid). The **top band is dead**: top-left, top-right and top-mid all resolve to `DIV.sbd-sh2--lead`, the section heading element, not the card link | `elementFromPoint` hit test after `scrollIntoViewIfNeeded`, `~/sbd-audit-scratch/a46b.mjs` | S3 | Verified
TP-A6-03 | / feed card | measured clickable area | Box 350x164. Only **2 of 7** probe points reach the card link (centre and bottom-left). The top band resolves to the parent `SECTION.sbd-feed-section`, the bottom-right to the Share button (correct), and **bottom-mid resolves to `TIME.sbd-eyebrow-date`**, so the card's own date line is not tappable | same method, two separate feed cards gave identical results | S3 | Verified
TP-A6-04 | /saved card | measured clickable area | `.sbd-card` on /saved has **no `.sbd-stretch` child at all**. Its link covers only the top region (`sbd-savedcard__top`); the lower strip is `DIV.sbd-savedcard__actions` and its buttons. That is defensible for a card whose bottom is an action row, but it is a different interaction model from the feed | live probe on /saved | S4 | Verified
TP-A6-05 | / | Month card | **NOT TESTED.** No `.sbd-rock` element is present on the homepage at the default Today horizon, so the Month card could not be measured in this pass | selector `.sbd-rock` returned 0 matches | - | Untested

### A7. Duplicates (EXP-009, DET-003)

**Verdict: CONFIRMED, but the cause is not what "duplicate" suggests.** These are recurring
events exploded into one row per occurrence, most of them already in the past.

TP-A7-01 | Supabase `things` | published rows sharing a normalized title AND the same start date | Only **6 groups, 6 extra rows**. True same-title-same-date duplication is rare: Diana Ross (Ticketmaster vs sbbowl.com), SBSA Open Studio Tour, 42nd Annual Vintners Festival, Karaoke Night at Dargan's, Whale Watch on Condor Express, Thee Sacred Souls (Ticketmaster vs sbbowl.com). **None came from the Sep 21 update** | `~/sbd-audit-scratch/a7.mjs` | S4 | Verified
TP-A7-02 | Supabase `things` | published rows sharing a normalized title AND the same venue | **154 groups, 619 extra rows.** Top offenders: Recreation Swim \| Oak Park Wading Pool 24x, Volunteer Gardening \| Alice Keck Park 21x, LOTG \| Bohnett Park 20x, Bilingual Songs & Stories 18x, Chess Club \| Louise Lowry Davis 16x, Read to a Dog 15x, LOTG \| State Street 15x | `~/sbd-audit-scratch/a7.mjs` | S2 | Verified
TP-A7-03 | the two named cases | what they actually are | "Santa Barbara Arts & Crafts Show \| Cabrillo Boulevard" is **17 published rows**, one per Sunday, each with its own `starts_at` and its own `event_key`. "Recreation Swim \| Oak Park Wading Pool" is **38 rows** across two pools, one per session. They are occurrences, not duplicates, and most are past | `~/sbd-audit-scratch/a7.mjs` section A7c | S2 | Verified
TP-A7-04 | Supabase `things` | whether they came from the Sep 21 update | Mostly no. The occurrence rows were created steadily from late June onward. The Sep 21 wave published **136** rows between 12:10 and 12:13 PM Pacific; those added more occurrences to existing series (Knit 'n' Needle, Baby & Me, LOTG, Chess Club) rather than creating the pattern | `updated_at` buckets: 19:10 UTC 6 rows, 19:11 48, 19:12 57, 19:13 25 | S3 | Verified
TP-A7-05 | lib/things.ts:253-277 | whether the detail page's nearby list excludes the current listing | **Yes**, via `.neq("id", excludeId)` | lib/things.ts:264 | S5 | Verified
TP-A7-06 | lib/things.ts:253-277 | whether the nearby list dedupes by title | **No.** There is no title grouping anywhere in `getNearbyThings`. Live proof: on `/thing/recreation-swim-oak-park-wading-pool` the section reads "Nearby in The Mesa" and lists **"Recreation Swim \| Oak Park Wading Pool" three times**, the same title as the page the user is standing on | live run, `~/sbd-audit-scratch/a9.mjs` | S2 | Verified

### A8. Where the civic and library items came from (EXP-001, EXP-004, EXP-005)

**Verdict: CONFIRMED. Nothing gates them, and today's live pick is one of them.**

TP-A8-01 | Supabase `things` | "Single Family Design Board - Consent" | **4 published rows.** The one on the homepage: id `fb2ecb7d-6fc4-551f-8ef9-6c7cbf744f53`, source `calendar.santabarbaraca.gov/event/single-family-design-board-consent-5483`, created 2026-09-16, **updated 2026-09-21 19:10 UTC (12:10 PM PT, in the update wave)**, status published, `hero_eligible: true`, happening_tier 1, quality_tier 2, starts 2026-09-21 18:00Z, address "Santa Barbara, Santa Barbara, CA", `nearby_zone: null`, tags: none | `~/sbd-audit-scratch/named.mjs` | S2 | Verified
TP-A8-02 | Supabase `things` | "Santa Barbara Youth Council" | **3 published rows**, source `calendar.santabarbaraca.gov`, created Aug 21 / Sep 9 / Sep 16, all `hero_eligible: true`, tier 1, quality_tier 2, address "Santa Barbara, Santa Barbara, CA", `nearby_zone: null` | same | S3 | Verified
TP-A8-03 | Supabase `things` | "S.B. Independent: Santa Barbara City Council District 6 Forum" | 1 published row, source `independent.com/events/...district-6-forum/`, created 2026-09-17, updated 2026-09-21 19:13 UTC, `hero_eligible: true`, tier 1, quality_tier 2, `nearby_zone: null`. Sibling District 4 and District 5 forum rows landed in the same wave | same | S3 | Verified
TP-A8-04 | Supabase `things` | every title starting with "LOTG \|" | **168 published rows** across 30 distinct stops, all from `calendar.library.santabarbaraca.gov` (LOTG is the library bookmobile, Library On The Go). All 168 are `hero_eligible: true`, all have an address, **102 of 168 are already past-dated**. Created on 33 separate days between 2026-06-30 and 2026-09-20 | same | S2 | Verified
TP-A8-05 | Supabase `things` | whether `hero_eligible` gates anything | **It gates nothing. All 1,529 published rows have `hero_eligible = true`**, including all 260 city-calendar rows, all 575 library rows, and all 1,108 past-dated rows. The flag exists but has never been used to exclude | `~/sbd-audit-scratch/named.mjs` | S1 | Verified
TP-A8-06 | lib/explore.ts:102-119 | how the day's pick is chosen today | `pickAutoHero(ordered, sbToday)` prefers `happening_tier === 1 && editorial_weight > 0 && starts_at != null && sbDay(starts_at) === today`, breaking ties on highest weight then soonest start. **If nothing qualifies it returns `ordered[0]`**, the first row of the ranked view, with no eligibility check of any kind | lib/explore.ts:102-119; wired at components/explore/ExploreClient.tsx:119-128 | S2 | Verified
TP-A8-07 | lib/explore.ts:118 | what prevents a civic meeting, a past start, or a no-address listing from becoming the pick | **Nothing.** The fallback branch checks no category, no tag, no `hero_eligible`, no address, and no start time. The preferred branch checks the date but not the time, so an event that already started today still qualifies | lib/explore.ts:102-119 | S1 | Verified
TP-A8-08 | production / | what the pick actually was during this pass | **"Single Family Design Board - Consent"**, rendered under "★ TODAY'S PICK / GRAY DAY MOVE" with the blurb "Design board review meeting.", linking to `/thing/fb2ecb7d-6fc4-551f-8ef9-6c7cbf744f53`. A municipal design-review hearing was the site's editorial recommendation for the day | live run 2026-09-21; screenshot `~/sbd-audit-scratch/shots/a8-home-pick.png` | S1 | Verified
TP-A8-09 | production / | what else led the feed | First feed titles in order: Baby & Me, Food Distribution \| Westside Neighborhood Center, Scrabble Club \| Louise Lowry Davis Center, Monday Night Football Watch Party, Santa Barbara Youth Council, USSB Community Choir, S.B. Independent: City Council District 6 Forum. Seven items, four of them civic or library calendar entries | live run | S2 | Verified

### A9. Plan with thin results (PLN-001)

**Verdict: CONFIRMED and reproduced exactly.**

TP-A9-01 | production /plan | the audit's first plan, rebuilt | Answers: Today, Afternoon, Couple, Anywhere, On foot, "Middle, one splurge", "Just lunch". The draft contains **exactly one stop**: "Food Distribution \| Westside Neighborhood Center" at 1:00 PM, labelled "Suggested", under the header "OPEN WHEN IT SAYS, CLUSTERED, PARKED, FED" | `~/sbd-audit-scratch/a9.mjs`; screenshot `shots/a9-plan-draft.png` | S1 | Verified
TP-A9-02 | lib/plan/meals.ts:102-108 | when "couldn't find an open lunch spot" renders | When `rankCandidates` returns nothing for the meal block: `if (!pick) notes.push({kind:"meal_unfilled", text:"We couldn't find an open lunch spot in your area and budget. Add one you like, or widen the plan."})` | lib/plan/meals.ts:102-108 | S4 | Verified
TP-A9-03 | lib/plan/validate.ts:81-90 | when "No lunch stop yet" renders | Only when the meal's block is active AND no stop in that block passes `isFood()`: `notes.push({kind:"meal_unfilled", text: "No lunch stop yet. Add one so the day has a meal at mealtime."})` | lib/plan/validate.ts:88 | S4 | Verified
TP-A9-04 | lib/plan/meals.ts:15-23 | **why the audit's first plan showed neither message** | Because a food bank is classified as a restaurant. `Food Distribution \| Westside Neighborhood Center` carries `happening_category: "food_drink_event"` and `activities: ["food-drink"]`, so `isFood()` returns true. `insertMeals` therefore found a pick (no meals.ts note) and `validatePlan` found a food stop in the afternoon block (no validate.ts note). Both honest-gap messages are suppressed by a misclassification. The live draft confirms it: `notes: []` | lib/plan/meals.ts:15-23; DB row `94d7ec3e-e4d9-59f9-bbbc-7aadea051d2c`; live draft rendered zero notes | S1 | Verified
TP-A9-05 | lib/plan/hardFilter.ts:118 | why "On foot" did not exclude it | The stop has `nearby_zone: null` and `neighborhood: null`, and the reachability check only runs `if (anchorZone && t.nearby_zone)`. An area-less candidate is never excluded on foot | lib/plan/hardFilter.ts:118; DB row shows both fields null | S2 | Verified
TP-A9-06 | app/plan/page.tsx:11 + production headers | whether /plan's candidate pool is cached, and for how long | **Yes.** `export const revalidate = 600` (10 minutes). Production serves it `x-vercel-cache: HIT`, `x-nextjs-prerender: 1`, `x-nextjs-stale-time: 300`, observed `age: 149`. The pool is also the truncated 996 rows from TP-A1-03 | app/plan/page.tsx:11; `curl -sI /plan` | S2 | Verified
TP-A9-07 | Supabase `things` | how thin the plan pool really is | 181 of 1,529 published rows pass `isFood()`, and that set includes `LOTG \| Samarkand` (a bookmobile stop) and four Food Distribution sites. After the 996-row pool cut and the past-date reality, a lunch search on foot has very little genuine restaurant inventory to choose from | `~/sbd-audit-scratch` isFood tally | S2 | Verified

---

## Section B: console and network

Method: each route loaded in a fresh headless Chromium context at 390x844 with an iPhone user
agent, waiting for `networkidle`. Console errors and warnings, page errors, failed responses and
requests slower than 2s were recorded. Raw data: `~/sbd-audit-scratch/b-console.json`.

| Route | HTTP | Load to networkidle | Console | Failed requests |
|---|---|---|---|---|
| / | 200 | 5,759ms | 0 | 2 (prefetch aborts) |
| /saved | 200 | 1,640ms | 0 | 1 (prefetch abort) |
| /discover | 200 | 2,549ms | 0 | 2 (prefetch aborts) |
| /discover/the-funk-zone | 200 | 2,503ms | **1 page error** | 1 (prefetch abort) |
| /discover/state-street-first-timer | 200 | 2,287ms | **1 page error** | 1 (prefetch abort) |
| /plan | 200 | 1,352ms | 0 | 2 (prefetch aborts) |
| /thing/baby-and-me-808c | 200 | 2,261ms | 0 | 2 (prefetch aborts) |
| /submit | 200 | 1,214ms | 0 | 1 (prefetch abort) |
| /digest/sample | 200 | 1,660ms | 0 | 0 |
| /weekend | 200 | 3,622ms | 0 | 3 (prefetch aborts) |
| /offline | 200 | 995ms | 0 | 0 |
| /s/54171ad3a2c142fa8dd89b22ac831e25 | 200 | 2,861ms | 0 | 4 (prefetch aborts) |
| /confirm?token=bad | 200 | 1,508ms | 0 | 0 |
| /this-page-does-not-exist | 404 | 769ms | 1 (the 404 itself) | 1 (the 404 itself) |

TP-B-01 | /discover/the-funk-zone, /discover/state-street-first-timer | hydration mismatch warnings | **Both guide pages throw `Minified React error #418`** on load, the production form of "hydration failed because the server-rendered HTML did not match the client". No other route in the set throws it. This is the only uncaught page error on the site | `pageerror` listener, both guide routes, reproduced on separate loads | S2 | Verified
TP-B-02 | all routes | Supabase clients created per page load | **Zero "Multiple GoTrueClient instances" warnings on any of the 14 routes.** The warning the browser-extension audit saw does not reproduce in a clean profile. It was most likely produced by the extension's own Supabase client sharing the page origin, not by the site | grep over all captured console output returns 0 matches for `GoTrueClient` | S5 | Verified
TP-B-03 | all routes | 404s for images or fonts | **None.** The only 404 recorded in the whole sweep is `/this-page-does-not-exist`, which is the intended one. No image, font or static asset failed | `b-console.json`, `failed` arrays | S5 | Verified
TP-B-04 | all routes | the `net::ERR_ABORTED` entries | These are Next.js `<Link>` prefetches (`?_rsc=...`) cancelled when the browser context closed at the end of each route's measurement. They are an artifact of the harness, not a site defect. The one non-`_rsc` abort on /weekend is the same prefetch mechanism | every aborted URL carries `?_rsc=` or is a prefetched `/thing/...` route | S5 | Likely
TP-B-05 | / | slow requests | The homepage HTML document itself took **3,236ms**, the only request over 2s anywhere in the sweep. `/` is `force-dynamic` and fetches the full 1,000-row pool on every request | `requestfinished` timing, `responseEnd` 3,236ms for the `/` document | S2 | Verified

---

## Section C: rendering and environment

### C1. Phone widths (390x844 and 320x568, touch emulation)

Screenshots: `~/sbd-audit-scratch/shots/c1-{390,320}-{home,home-lens,home-search,saved,plan-step1,plan-draft,guide,detail}.png`. Raw data: `~/sbd-audit-scratch/c1.json`.

| Route | 390px overflow | 320px overflow | controls <44px (390) |
|---|---|---|---|
| / | **14px** | **83px** | 9 |
| / with filter sheet open | **14px** | **83px** | 9 |
| / with search overlay | **14px** | **83px** | 10 |
| /saved | 0 | 0 | 4 |
| /plan step 1 | 0 | 0 | 1 |
| /plan draft | 0 | 0 (3 clipped) | 2 |
| /discover/the-funk-zone | 0 | 0 | 13 |
| /thing/baby-and-me-808c | 0 | **27px** | 3 |

TP-C1-01 | / | horizontal overflow at phone width | **The homepage scrolls sideways at every phone width tested.** At 390px, `scrollWidth` is 404 against a 390px viewport. Two elements cause it: the WHEN segment (`DIV.sbd-horizon` / `DIV.sbd-seg`, right edge 403, with the "Month" button at 399) and the bottom tab bar (`NAV.sbd-nav`, right edge 404, with "Discover SB" at 404). At 320px the overflow grows to **83px** | `document.documentElement.scrollWidth - clientWidth`, measured on 3 homepage states at 2 widths | S2 | Verified
TP-C1-02 | /thing/[id] | overflow at 320px | 27px. `A.sbd-detailact` "Directions" runs to 347 and the bottom nav to 347, against a 320px viewport | c1.json, `detail` at tag 320 | S3 | Verified
TP-C1-03 | /plan draft | clipping at 320px | The draft header clips: `DIV.sbd-header__name` "Your draft, editable" and `DIV.sbd-header__tag` "OPEN WHEN IT SAYS, CLUSTERED, PARKED, FED" both extend to 366 against a 320px viewport, without producing page-level overflow (so they are cut off rather than scrollable) | c1.json, `plan-draft` at tag 320 | S3 | Verified
TP-C1-04 | / | controls under 44x44 | 9 at 390px: `button.sbd-search-btn` "Search" **40x40**; all four WHEN buttons at **38px tall** (Today 73x38, This Week 70x38, This Weekend 95x38, This Month 76x38); `a.sbd-brandhdr__logo` 187x36; `a.sbd-skip` 148x42; `a.sbd-signup__sample` 148x22; `a.sbd-foot__submit` 239x26 | live `getBoundingClientRect` sweep | S3 | Verified
TP-C1-05 | /discover/the-funk-zone | controls under 44x44 | 13, the worst of any route. Five are the sketch-map jump targets, SVG `<g>` elements at **21x21** labelled "Jump to stop 1" through "Jump to stop 5" | live sweep | S3 | Verified
TP-C1-06 | /plan draft, /saved | further small controls | `button.sbd-plan-back` "Back to setup" is **16x44** (16px wide). `button.sbd-ctrl__near` "Near Me" on /saved is **85x26** | live sweep | S3 | Verified
TP-C1-07 | / | text under 16px | Four size bands on the homepage alone: **10px** (5 nodes, the occasion pills "FAMILY DAY", "SOLO", "NIGHTLIFE"), **11px** (5 nodes, `sbd-brandhdr__eyebrow` "SANTA BARBARA", the pick ribbon star, the nav labels "Explore"/"Saved"/"Discover SB"), **12px** (14 nodes, `sbd-hero__daypart` "GOOD AFTERNOON", the weather and sunset chips), **14px** (22 nodes, the door labels "Place"/"Occasion"/"Activity"). The guide page has 11 distinct sub-16px bands | `getComputedStyle().fontSize` over leaf text nodes | S3 | Verified

### C2. Fresh visitor

TP-C2-01 | / | welcome overlay behavior in a brand-new context | On visit 1 a modal appears: `role="dialog"`, `aria-modal="true"`, `aria-label="Welcome to SB Daymaker"`, inside a `.sbd-scrim`, presented as a 3-step carousel with a "Skip" control. It is a genuine modal and **intercepts all pointer events on the page beneath**, which is correct modal behavior but means nothing on the homepage is tappable until it is dismissed | live run, `~/sbd-audit-scratch/c2389.mjs`; screenshot `shots/c2-visit1-overlay.png` | S4 | Verified
TP-C2-02 | / | localStorage keys set on a first load | Three, all written before any user interaction: `sbd.tour.v1` = `"seen"`, `sbd.saves.v1` = `{}`, `sbd.itineraries.v1` = `[]`. Note that **`sbd.tour.v1` is already `"seen"` while the overlay is still on screen**, so it is written on mount, not on dismissal | live read of `Object.keys(localStorage)` on visit 1 | S4 | Verified
TP-C2-03 | / | what changes across the first three visits | **Nothing observable.** Reloaded four times: the overlay appears on visit 1 only (correct), and the hero is byte-identical on all four visits ("MONDAY, SEPTEMBER 21 · GOOD AFTERNOON / ⛅ 74° / ◐ Sunset 6:57 PM / Everything worth doing in Santa Barbara, in one place."). No visit counter is stored and no visit-count logic exists in `components/explore/Hero.tsx`. **The first-three-visits hero rule is not present in the current build** | 4 sequential loads in one context; grep for `visitCount`/visit-count logic in Hero.tsx returns nothing | S3 | Verified
TP-C2-04 | /s/54171ad3a2c142fa8dd89b22ac831e25 | whether hearts render empty or filled in a new empty context | **Empty, which is correct.** All three heart controls read `aria-pressed="false"` with labels "Save Monday Night Football Watch Party", "Save USSB Community Choir", "Save Scrabble Club \| Louise Lowry Davis Center". The recipient sees an unsaved list they can save from, not a pre-filled one | live run; screenshot `shots/c2-shared-list.png` | S5 | Verified

### C3. Offline

TP-C3-01 | / | service worker registration | One registration after a single online load: `https://www.sbdaymaker.com/sw.js` | `navigator.serviceWorker.getRegistrations()` | S5 | Verified
TP-C3-02 | / offline | what renders | **Correct.** The service worker serves the offline page: "NO CONNECTION / You're offline / Santa Barbara isn't going anywhere. Reconnect and we'll pick up right where you left off, your saved list lives on this device either way. / Try again" | live offline run; screenshot `shots/c3-offline_.png` | S5 | Verified
TP-C3-03 | /saved offline | what renders | **The offline page is NOT served.** The user gets a generic error boundary: "This page couldn't load / Reload to try again, or go back. / Reload / Back". This is the one page whose content lives entirely in localStorage and would work offline, and it is the one the service worker does not cover | live offline navigation | S2 | Verified
TP-C3-04 | /thing/[id] offline | what renders | Same generic error boundary, "This page couldn't load". The service worker's offline fallback only covers `/` | live offline navigation | S3 | Verified

### C4. Slow network (Lighthouse mobile, throttled)

| Route | Performance | Accessibility | LCP | CLS | TBT | FCP | Speed Index |
|---|---|---|---|---|---|---|---|
| / | **66** | 93 | **15.8 s** | 0 | 70 ms | 2.4 s | 6.3 s |
| /thing/baby-and-me-808c | 97 | 96 | 2.7 s | 0 | 10 ms | 1.0 s | 1.7 s |
| /saved | 84 | 100 | 4.1 s | 0 | 30 ms | 2.3 s | 2.3 s |
| /plan | 84 | 100 | 4.1 s | 0 | 0 ms | 2.3 s | 2.3 s |

TP-C4-01 | / | throttled mobile performance | **Largest Contentful Paint is 15.8 seconds**, performance score 66. Cumulative Layout Shift is a perfect 0 and Total Blocking Time is only 70ms, so this is not a jank or script-execution problem: it is time-to-content. The homepage is `force-dynamic` and fetches the full 1,000-row pool server-side on every request, and its HTML document alone took 3.2s unthrottled (TP-B-05) | Lighthouse 12 mobile preset, `~/sbd-audit-scratch/lh-home.json` | S1 | Verified
TP-C4-02 | /thing/[id] | throttled mobile performance | Healthy: score 97, LCP 2.7s. The detail page is not implicated | `lh-detail.json` | S5 | Verified

### C5. Reduced motion

TP-C5-01 | / | whether animations stop under prefers-reduced-motion | **They do. This works correctly.** With `no-preference`, two elements animate: `span.sbd-brandhdr__sun` (`sbdBrandhdrSun`, 3.4s, **iteration-count: infinite**) and `span.sbd-hero__sun` (`sunEntry` 0.8s once, plus `sunPulse` 3s infinite). With `reduce`, the count of animating elements drops to **0**, including the infinite loops | live comparison of `getComputedStyle().animationName` across both contexts | S5 | Verified

### C6. Zoom to 200 percent

Simulated by halving the CSS viewport to 195x422, which is how a 390px phone renders at 200% zoom.

TP-C6-01 | / | overflow and unreachable controls at 200% | **209px of horizontal overflow** (scrollWidth 404 against a 195px viewport). Ten controls sit outside the viewport: the search button (right edge 224), the "Week" (220), "Weekend" (320) and "Month" (399) WHEN buttons, and six card title links. The WHEN segment does not wrap or scroll, so **three of the four time filters are unreachable at 200% zoom without horizontal panning** | live measurement; screenshot `shots/c6-zoom200_.png` | S2 | Verified
TP-C6-02 | /thing/[id] | overflow and unreachable controls at 200% | **152px of overflow** (scrollWidth 347). Six controls out of view: the search button, the "Share" and "Directions" detail actions, and the bottom nav including "Saved" and "Discover SB". **The bottom tab bar is partly unreachable** | live measurement; screenshot `shots/c6-zoom200_thing_baby-and-me-808c.png` | S2 | Verified

### C7. Contrast

Two methods were used. Lighthouse runs axe-core, which composites backgrounds correctly and is
the authority here. A second computed-style pass measured the specific pairs named in the brief.
A third, pixel-sampling pass was attempted for text sitting on photographs; **it proved
unreliable and its numbers are not reported as findings** (see TP-C7-05).

TP-C7-01 | / | Lighthouse accessibility | Score **93**. Three audits fail: `color-contrast` (1 node), `label-content-name-mismatch` (2 nodes), `target-size` (3 nodes) | `lh-home.json` | S2 | Verified
TP-C7-02 | /saved, /plan | Lighthouse accessibility | **100 on both.** /saved has one `label-content-name-mismatch` node; /plan has zero failing audits | `lh-saved.json`, `lh-plan.json` | S5 | Verified
TP-C7-03 | /thing/[id] | Lighthouse accessibility | Score 96. `color-contrast` fails on `main#main > div.sbd-detail > div.sbd-detail__actions > a.sbd-btn`: **4.45:1** (`#fcfaf5` on `#c0532e`), just under the 4.5 minimum for 16px text. My independent measurement of the same element gave 4.46:1 | `lh-detail.json` + computed-style pass | S3 | Verified
TP-C7-04 | /saved | the Build a day sub-line | `a.sbd-build-cta > div.sbd-build-cta__body > span.sbd-build-cta__sub`: **3.8:1** (`#f6e5e0` on `#c0532e`) at 14px, against a 4.5 minimum | Lighthouse `color-contrast` audit on `/` | S3 | Verified
TP-C7-05 | the named pairs | measured ratios, solid backgrounds only | **Card time line** (`.sbd-eyebrow-date`): passes, dark ink on paper. **WHEN chips** (`.sbd-seg__btn`): 15.6:1 and 13.9:1, pass comfortably. **Filter-tile counts** (`.sbd-tile__count`): **11.9:1, pass**, white on the solid `#0e3c49` scrim. **Placeholder tile captions** (`.sbd-tile__label`): **11.4:1, pass**, `#fcfaf5` on the same scrim. The tile scrim is doing its job | computed-style pass with ancestor background resolution, `~/sbd-audit-scratch/c7.mjs` | S4 | Verified
TP-C7-06 | / | occasion pills, solid backgrounds | Two of the pill colours fall short at 10px: **"FAMILY DAY" 3.48:1** (`#fcfaf5` on `#7e8b6b`, the sage token) and **"ARTS" 4.02:1** (`#fcfaf5` on `#9c6b9e`). Others pass comfortably ("SOLO" 9.67:1, "NIGHTLIFE" 16.07:1). Lighthouse did not flag these, most likely because the failing pills were not in the audited viewport | computed-style pass; both backgrounds are flat colours, so the measurement is reliable | S3 | Likely
TP-C7-07 | / Month cards, door tiles, hero chips, pick ribbon | text over photographs | **NOT RELIABLY MEASURED.** These sit on photographic tiles under a gradient scrim. The computed-style method resolves the page background rather than the photo and reports a meaningless ~1.08:1; a pixel-sampling method disagreed with itself between runs and mistook anti-aliasing for text (it scored a tile caption at 1.01:1 that the reliable method scored at 11.4:1). Lighthouse/axe, which composites correctly, flagged **none** of these. Treat as unmeasured rather than failing | `~/sbd-audit-scratch/c7.mjs` and `c7px.mjs`, contradictory results | - | Untested

### C8. Time of day

`page.clock` was installed and fixed at each target time in `America/Los_Angeles`. Screenshots:
`~/sbd-audit-scratch/shots/c8-{mon-0800,mon-1300,mon-1800,mon-2330,sat-1100}.png`.

TP-C8-01 | / | which values move with the browser clock | **Almost none.** At 8:00 AM, 1:00 PM, 6:00 PM and 11:30 PM Monday, and 11:00 AM Saturday, the hero read "MONDAY, SEPTEMBER 21 · GOOD AFTERNOON" in **all five cases**, the real server time. The pick, the "GRAY DAY MOVE" label and the WHEN segment were identical in all five | live clock runs, `~/sbd-audit-scratch/c8.mjs` | S4 | Verified
TP-C8-02 | lib/weather.ts:10-32 | why, from the code | `getTimeOfDay()` and `getDateLabel()` both call `new Date()` **on the server** and format in `America/Los_Angeles`; the file's own header says "Both computed server-side... server-stable, no hydration drift". `/` is `force-dynamic`, so these are correct for the real clock but cannot be exercised from the browser. Buckets: morning 05:00-10:59, afternoon 11:00-16:59, evening 17:00-20:59, night 21:00-04:59, labelled "Good morning", "Good afternoon", "Golden hour", "After dark" | lib/weather.ts:10-22; components/explore/Hero.tsx:5-10 | S4 | Verified
TP-C8-03 | components/explore/derive.ts:121-122 | what drives the "Gray day move" label | **Weather, not the clock.** `heroEyebrow()` returns "Gray day move" as its very first branch whenever `isGrayDay(weather)` is true, which is any non-clear condition containing "cloud", "rain" or "fog". It therefore **pre-empts every other eyebrow** (Place to be, Free · Today, Catch a show, Arts & culture, Happy hour, Today's pick). With the observed "⛅ 74°" partly-cloudy reading, every pick on a cloudy day is labelled "Gray day move" regardless of what it is | components/explore/derive.ts:121-122, 12-16 | S3 | Verified
TP-C8-04 | / | the one value that does move | The sunset chip is client-computed and did respond: "◐ Sunset 6:57 PM" at 8 AM, 1 PM and 11:30 PM, changing to "**◐ 57 min of gold left**" at 6:00 PM, and to "◐ Sunset 6:50 PM" for the Saturday date | live clock runs | S5 | Verified
TP-C8-05 | / | WHEN counts | **There are no counts on the WHEN segment in the current build.** The four buttons read exactly "Today", "Week", "Weekend", "Month" with no numbers, at every simulated time. The "Weekend" button's accessible name is "This Weekend"; it carries no date range. Counts do exist, but inside the filter sheet tiles ("126 this month", "2 today") | live reads of `.sbd-seg__btn` innerText at all five times | S4 | Verified
TP-C8-06 | / | what Weekend resolves to | Not determinable from the browser. `weekendKeys(now)` at lib/explore.ts:123-131 computes Fri/Sat/Sun of the current or upcoming weekend from the **server** clock, UTC-anchored to dodge DST; if today is already Sat or Sun the window still ends that Sunday | lib/explore.ts:123-131 | S4 | Verified

### C9. Keyboard focus

TP-C9-01 | / | interactive elements lacking a visible focus ring | **None. This works correctly.** A first pass appeared to find 7 card title links (`a.sbd-stretch`) with `outline-style: none`, but that was a false positive: the ring is deliberately drawn on the **parent card**, not the link. Verified by tabbing to a card link and reading the ancestor: `ARTICLE.sbd-card` takes `outline: 3px solid rgb(22, 88, 106)` (the Pacific token) while the link itself takes `outline: none`. The rule is `.sbd-listcard:has(.sbd-stretch:focus-visible) { outline: 3px solid var(--pacific); outline-offset: 2px }` | app/components.css:555-561; live verification in `~/sbd-audit-scratch/c9b.mjs`; screenshot `shots/c9-focus-card.png` | S5 | Verified
TP-C9-02 | /thing/[id] | focus rings | 15 elements tabbed, **0 without a visible focus ring** | live tab sweep | S5 | Verified

---

## Section D: verdicts, fix locations, gaps

### D1. A1 to A9 verdicts

| # | Hypothesis | Verdict | One line of evidence |
|---|---|---|---|
| A1 | Saves vanish | **Confirmed** (worse than stated) | Saved two real items on production, opened /saved, `sbd.saves.v1` went from 2 ids to `{}`; 533 of 1,529 published things sit outside the pool the cleanup checks against |
| A2 | Areas are ignored | **Confirmed** | `ExploreClient.tsx:113` passes Place to `sortByDoorZone`, a sort, while Vibe and Activity get real filters; and 585 of 1,529 published things have `nearby_zone = null` |
| A3 | Cache staleness after an update | **Confirmed** (from code and headers; live trigger not run) | `/saved`, `/plan`, `/discover` are `x-vercel-cache: HIT` with `revalidate = 600` while `/` is `force-dynamic`, and nothing in `ingest/` calls `revalidatePath` |
| A4 | Restore panel gated at 5+ | **Confirmed** as to the rule; the feature works | `.sbd-restore` renders 0 times at 4 saves and once at 5; the live request returned `{"ok":true,"sent":true}` and the link worked in a fresh context |
| A5 | Been confirmation | **Confirmed in part** | The toast renders correctly for ~2.5s, but after one flip the tab badge still reads 6 while Want to go reads 5 |
| A6 | Whole-card tap target | **Confirmed in part** | The `.sbd-stretch::after` overlay exists and works, but only 2 of 7 probe points on a feed card reach the link; the top band and the date line are dead |
| A7 | Duplicates | **Confirmed**, different cause | Only 6 true same-title-same-date duplicates, but 619 extra rows are recurring occurrences, and the nearby list on a Recreation Swim page shows that same title three times |
| A8 | Civic and library items | **Confirmed** | All 1,529 published rows carry `hero_eligible = true`, nothing gates the pick's fallback branch, and today's live pick was "Single Family Design Board - Consent" |
| A9 | Plan with thin results | **Confirmed** | The rebuilt plan produced exactly one stop, "Food Distribution \| Westside Neighborhood Center", with zero notes, because a food bank is classified `food_drink_event` and satisfies the lunch check |

### D2. Where a fix would go, and rough size

Sizes: S = a contained change in one file. M = a few files, or one file plus a data pass. L = a
design decision plus a migration or a pipeline change.

| Problem | Files | Size |
|---|---|---|
| The 1,000-row ceiling truncates the public catalog (**root cause of A1, and a contributor to A2, A9, C4**) | `lib/things.ts` (`getPublishedThings`, line 201) | **S** to stop the truncation; **M** if paging or a server-side filter is wanted |
| Past events are never retired, 1,108 of 1,529 published rows (**the reason the ceiling is hit at all**) | `ingest/` (a retirement step), plus `lib/things.ts` if a read-time date filter is preferred | **M** |
| The ghost-save cleanup deletes on a pool it cannot trust | `components/saved/SavedClient.tsx:76-81` | **S** |
| A guide can save something /saved cannot see | `lib/guides.ts:130-157` and `lib/things.ts` (make the two reads agree) | **S** |
| Explore's Place door sorts but is labelled a filter | `components/explore/ExploreClient.tsx:113,151`; `components/explore/DiscoveryDoors.tsx:12`; `lib/doorZones.ts:74-83` | **S** to relabel, **M** to make it filter |
| Two area taxonomies over two columns | `lib/zones.ts`, `lib/doorZones.ts`, `lib/tiles.ts:23-28`, `lib/plan/hardFilter.ts:118` | **L** |
| 585 published things with no `nearby_zone`, 610 with no door zone | ingest enrichment plus a backfill; the sweep console at `app/admin/(console)/coverage/neighborhood-sweep` already exists for this | **M** |
| Nothing revalidates after ingest writes | `ingest/run.ts` (add revalidation), or lower `revalidate` on the four ISR routes | **S** |
| `hero_eligible` gates nothing; the pick's fallback checks nothing | `lib/explore.ts:102-119` (the `ordered[0]` fallback), plus a data pass on `hero_eligible` | **M** |
| "Gray day move" pre-empts every other pick eyebrow | `components/explore/derive.ts:121-122` | **S** |
| Nearby list does not dedupe by title | `lib/things.ts:253-277` (`getNearbyThings`) | **S** |
| A food bank counts as a lunch stop | `lib/plan/meals.ts:15-23` (`isFood`), plus the `happening_category` assignment in `lib/enrich.ts` | **M** |
| Been toast count vs tab badge disagree | `components/saved/SavedClient.tsx:142-147` and whatever renders the tab badge | **S** |
| Feed card top band and date line are not tappable | `app/components.css` around 5844-5861 and the `.sbd-listcard` rules near 540-560 | **S** |
| Homepage overflows sideways at 390px and 320px | `app/components.css`, the `.sbd-horizon` / `.sbd-seg` and `.sbd-nav` rules | **S** |
| WHEN segment unreachable at 200% zoom | same rules; needs wrapping or horizontal scroll | **S** |
| Homepage LCP 15.8s on throttled mobile | `app/(app)/page.tsx:9` and `lib/things.ts:201` (payload size is the driver) | **M** |
| Service worker does not cover /saved offline | `public/sw.js` | **S** |
| Guide pages throw React #418 hydration errors | `components/discover/GuideWalkSection.tsx` and the guide page's server render | **M** |
| Contrast: detail CTA 4.45:1, Build-a-day sub 3.8:1, two pill colours below 4.5 | `Core Project Files/sbdaymaker_tokens.css` and `app/components.css`; `lib/occasions.ts:37-40` for the pill colours | **S** |
| Tap targets under 44x44 (search 40x40, WHEN buttons 38px tall, guide map targets 21x21, plan back 16x44) | `app/components.css`; the sketch-map components in `components/discover/` | **S** |

### D3. What could not be tested, and why

1. **A3's live trigger.** Watching a real content change flow through the caches needs an INSERT or UPDATE. This pass is read-only, so A3 is proved from code paths and live cache headers instead, which the brief allows.
2. **Chrome DevTools browser tools.** No Chrome MCP tooling is connected to this session, so every live interaction, console capture and screenshot was done through Playwright from the scratch folder. This changed nothing about what could be observed, but it means the console sweep ran in a clean profile with no extensions, which is why the "Multiple GoTrueClient instances" warning did not reproduce (TP-B-02).
3. **The Month card tap target (A6).** No `.sbd-rock` element renders on the homepage at the default Today horizon, so the Month card's clickable area could not be measured. Month cards do render after switching the horizon, and their contrast was attempted in C7.
4. **Contrast of text over photographs (C7).** Door labels, Month card titles, hero chips and the pick ribbon sit on photographic tiles under gradient scrims. Neither available method gave trustworthy numbers, and the two methods contradicted each other. Lighthouse/axe, which composites correctly, flagged none of them. Reported as unmeasured, not as passing or failing.
5. **The prior UI audit log.** `docs/audits/SB_Daymaker_UI_Audit_Log.md` does not exist in this repo, and no file matching `*UI_Audit*` was found under the repo, Documents, Downloads or Desktop. The 103 findings were not available to cross-reference, so every hypothesis here was verified from scratch against the code, the database and the live site.
6. **Email delivery confirmation (A4).** The API returned `sent: true`, meaning Resend accepted the message. Whether it landed in the jim@sourcewyse.com inbox, or in spam, cannot be checked from here.
7. **The restore token issued during A4.** Token `9d983a668c4147ecb157f46e52460e85` now exists in the database, holding a snapshot of the 5 test saves. It was created by the one permitted form submission. No cleanup was performed, because that would be a write.
8. **Real-device behavior.** Everything in Section C is Chromium emulation. Safari on a real iPhone may differ, particularly for the service worker (C3) and the 200% zoom reflow (C6).

---

*Audit performed 2026-09-21. No application code, data, content, schema or configuration was
modified. Scratch artifacts, screenshots and scripts: `~/sbd-audit-scratch/`.*
