# SB Daymaker — Build Deltas Ledger

Canon amendments recorded as builds diverge from or extend the v9 canon
(`Core Project Files/CLAUDE.md`). Each entry cites the driving spec so canon and
code stay reconcilable. Newest first.

---

## 2026-07-10 — Card Imagery Phase 3 addendum: venue-pool match now beats the Tier-1 no-photo default

Source: Jim's question after the Phase 3 stop-and-show — "did you backfill any
existing things that had a place already assigned to a venue that was using a
venue's image?" Investigated live rather than answering from memory.

**Finding:** 58 approved `venue_photos` exist across 18 curated venues (SOhO,
Lobero, SB Bowl, Granada, Arlington, Courthouse, Old Mission, Stearns Wharf,
MOXI, SB Museum of Art, Chase Palm Park, Alameda Park, SB Zoo, and several
auto-created ones) — real founder curation, not something built this session.
But `eventDefaultsToNoPhoto` (Phase 0) has ALWAYS forced every Tier-1 dated
event to skip photos unconditionally, with no exception for a venue-pool match
— so none of the ~110 dated events at those 18 venues ever showed the curated
photo; only each venue's own standalone Tier-3 "place" card did. Phase 3's
backfill didn't create this gap (it predates this session by weeks) but made it
newly visible (a motif instead of a blank card), which is what surfaced the
question. This also directly contradicts the Build Spec §2 priority table,
which lists "Venue pool" at priority 2, explicitly "any card (place or dated
event)" — ranked above "Motif... all remaining dated events" at priority 5.
Flagged rather than silently carried forward; Jim confirmed: fix it.

**Built:**
1. **`ingest/images.ts`** — `noPhoto` in the resolver's final loop is now
   `!chosen.url || (eventDefaultsToNoPhoto(c) && !poolMatched)`. A NON-pool
   Tier-1 pick (generic Wikimedia/Google) still defaults to no photo, unchanged.
   `loadVenuePools`/`matchVenueForCandidate` exported so...
2. **`ingest/run.ts`**'s `backfillPublishedImages()` Tier-1 fast path — checks
   for a pool match FIRST (via the newly-exported functions above) and writes
   the rotated pool photo (`pickFromPool`, same function the live resolver
   uses) instead of calling `assignVisual`; only falls to motif/big-type when
   there's genuinely no pool match. Re-checks every Tier-1 row on every run
   (not just ones missing an assignment) — pools grow as Jim curates more
   venues, so a row already sitting on 'motif' from a prior run still needs
   re-verifying against the CURRENT pool state, not skipped forever.
3. **Re-ran `IMAGE_BACKFILL_PUBLISHED=1`**: 110/505 Tier-1 rows updated (88
   google-sourced, 22 wikimedia-sourced pool photos). Spot-checked "Molly
   Miller Trio," "Colonel Angus," "Trevor Noah" — all now show the real venue
   photo with correct attribution ("Rob Blaze (Google)" etc.) instead of a
   generic motif. Published catalog: `{google: 115, motif: 414, wikimedia: 30}`
   — zero pexels, zero placeholder, unchanged from before this fix.

**Second finding, caught while screenshotting the fix, not by inspection alone:**
`lib/venuePool.ts`'s `dedupeFeedVenuePhotos()` — the per-feed-render dedupe pass
that rotates a venue's pool across same-day siblings — still fell to a BARE
`photo_source: 'placeholder'` once a venue's pool was exhausted mid-render (its
own comment already said "motif is Phase 3," and my own Phase 3 ledger entry
above explicitly deferred fixing this, reasoning "every venue pool in
production is currently empty... this path is presently unreachable" — true
when I wrote it, false by the time Jim answered the venue-pool question, and
directly made WORSE by fix #1-2 above: Tier-1 events now attempt pool photos
too, so a high-volume venue like SOhO (59 published dated events sharing a
3-photo pool) exhausts constantly). Screenshotting "Molly Miller Trio" (a
SOhO event, correctly pool-matched in the DB — confirmed via a direct query
AND a network-level check that its assigned photo URL loads fine) still showed
a blank gradient in the Week view; traced it to this exact exhaustion path
firing for the 4th+ SOhO card in that render. Fixed: the exhaustion branch now
calls `assignVisual()` (no network — pure hash) instead of hardcoding
`'placeholder'`, so an exhausted-pool card gets a real motif/big-type instead
of nothing. `FeedDedupeItem` widened to carry `happening_category` (assignVisual's
input) and the three visual columns (its output); `Thing` already had all of
these, so no caller-side changes were needed beyond the interface. One existing
unit test (`venuePool.test.ts`'s exhaustion case) updated to assert `'motif'`
instead of `'placeholder'`. Re-screenshotted after the fix: "Molly Miller Trio"
now shows the big-type "SUN" card instead of a blank gradient.

**Verification:** `tsc --noEmit` clean (checked specifically for venuePool.ts/
visualAssignment.ts — no new errors); 550/550 vitest.

**Files touched:** `ingest/images.ts` (`loadVenuePools`/`matchVenueForCandidate`
exported, resolver `noPhoto` exception), `ingest/run.ts` (Tier-1 fast path
rewritten, `loadVenuePools`/`pickFromPool`/`sbDay` imports), `lib/venuePool.ts`
(`dedupeFeedVenuePhotos` exhaustion fallback, `FeedDedupeItem` widened),
`lib/venuePool.test.ts` (one test updated).

---

## 2026-07-10 — Card Imagery Phase 3 (motif tier + Pexels retirement) — built, backfilled, verified

Source: `docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md` §6. Continues from
the kickoff entry directly below, after Jim confirmed the DDL had been run
(verified live: `visual_kind`/`visual_key`/`visual_seed` columns present, `'motif'`
enum value queryable).

**Built:**

1. **`lib/visualAssignment.ts`** (new, pure, 10 unit tests) — `assignVisual()`:
   deterministic `visual_kind`/`visual_key`/`visual_seed` from a thing's id +
   category + an optional marquee-venue match. Category → motif pool
   (`CATEGORY_MOTIFS`) covers all 16 `HappeningCategory` values; `mission`/`wharf`
   are excluded from the generic pool and reserved as venue-family overrides
   (`VENUE_MOTIFS`, reusing `matchMarqueeVenue`) so they only ever render on the
   real landmark. ~1-in-8 things get big-type even when a motif pool exists,
   replicating the mockup's own demonstrated behavior (its Lobero card used
   big-type despite arts_theater having a valid motif) rather than treating
   big-type as strictly "no motif available." `visual_seed` is masked to 31 bits
   (`hashString(id) & 0x7fffffff`) — caught live during the backfill (see below).
2. **`components/visuals/`** (new) — `SvgDefs.tsx` (the shared `#sbd-grain`/
   `#sbd-vig`/`#sbd-tremble`/`#sbd-tremble2`/`#sbd-peli` defs, mounted once in
   `app/layout.tsx`, not per-card), `motifs.tsx` (all 9 motifs, path data ported
   verbatim from the mockup — verified by rendering the REAL components with
   `renderToStaticMarkup` into a QA page rather than hand-copying twice), and
   `BigType.tsx` (the D8 fallback — day-abbreviation + neighborhood/date when
   `starts_at` exists, else `nearby_zone` + category; dynamic font sizing so a
   long zone name like "waterfront" never overflows the 100-unit viewBox the way
   a fixed 36px only sized for "1873" would have).
3. **`components/ui/Card.tsx`** — `ListCard` render order: photo → motif → bigtype
   → the pre-existing occasion-gradient (now the true last resort). New `visual`
   prop (`CardVisual`), assembled by `cardVisual()` in `components/explore/
   derive.ts` from a `Thing`'s `visual_kind`/`visual_key`/`starts_at`/
   `neighborhood`/`nearby_zone`/`happening_category`. Threaded through every
   `ListCard` call site (`CascadeFeed.tsx` ×3, `LeadDayRail.tsx`, `SharedListView.
   tsx`) — `PickCard` (140px band) was skipped: grepped the tree, it's exported
   but imported nowhere, dead code.
4. **`ingest/images.ts` resolver** — every miss (a genuine free/paid-tier miss,
   OR a Tier-1 event's forced no-photo, OR a relevance-rejected pick, OR the
   place-level cache-hit fast path) now resolves to `photo_source: 'motif'` +
   `assignVisual()`'s output instead of the bare `'placeholder'` sentinel.
   `rankOptions()`'s order array dropped `'pexels'`; a historical pexels entry
   surviving in a stored `photo_options` list (the only way one can still reach
   this function) now sorts LAST among real options via an explicit "unranked →
   sorts after every known source" comparator, not first (a naive `indexOf` of
   -1 would have promoted it to the top — caught before it shipped).
   `pexelsMany`/the rate-limit flag/`PEXELS_API_KEY` deleted; `findMoreOptions`
   is Wikimedia-only now.
5. **`ingest/land.ts` + every `ingest/run.ts` backfill** (`backfillImages`,
   `backfillPublishedImages`, `backfillFoodImages`, `backfillRepeatImages`,
   `handleDeadVenuePhoto`) — all persist `visual_kind`/`visual_key`/`visual_seed`
   alongside `photo_source` now. `backfillPublishedImages`'s Tier-1 fast path
   (previously a hardcoded no-network `{photo_url:null, photo_source:
   'placeholder'}`) now calls `assignVisual()` directly (still no network — pure
   hash + a marquee-registry lookup), and `handleDeadVenuePhoto`'s no-Wikimedia-
   replacement branch (flagged in its own 2026-07-10 addendum comment as "Phase 3
   hasn't started") now assigns each affected thing its own motif/big-type
   instead of a blanket placeholder.
6. **Deliberately left alone, flagged not fixed:** `lib/venuePool.ts`'s
   `dedupeFeedVenuePhotos()` still falls to a bare placeholder when a venue's
   pool is exhausted mid-render — its own comment already said "motif is Phase
   3." Not wired up: the affected item shape (`FeedDedupeItem`) doesn't carry
   `happening_category`, and every venue pool in production is currently empty
   (curation hasn't happened yet — confirmed via the Phase 2 ledger), so this
   path is presently unreachable. Real but low-priority; noted for a follow-up
   rather than expanding this phase's diff to widen a render-time interface for
   dead code.
7. **RockTile (Month view)** and **Hero** stay out of scope, per Jim's explicit
   answer during kickoff (feed cards only) — both already have a non-blank
   fallback (a terracotta→pacific-dark gradient and a flat `--bg` respectively),
   confirmed unbroken by this phase's changes via screenshot (Month view below).

**Bug caught and fixed before it reached the live DB:** the first backfill run
crashed — `visual_seed integer` (Postgres signed int4, max ~2.147B) rejected a
`hashString()` output above that range (`hashString` returns a full unsigned
32-bit value, up to ~4.29B). Fixed by masking to 31 bits in `assignVisual()`
rather than reaching for new DDL. Rows written before the crash were already
valid (Postgres rejects out-of-range writes atomically, so nothing landed
corrupted) and the retry picked up exactly where it left off — the Tier-1 skip
guard (`photo_source === 'motif' && visual_kind`) and the Tier-2/3 `GOOD_SOURCES`
filter made the re-run naturally idempotent, no manual cleanup needed.

**Backfill — run locally against production (`npx tsx ingest/run.ts` with env
loaded from `.env.local`; `getDb()`'s own header comment documents this local
path exists precisely so the worker "also runs locally" — same execution path
used throughout Phase 1/2 per the ledger, since this branch's whole Phase 1/2
body of work sits uncommitted and was never pushed for a GitHub Actions run):**
- `IMAGE_BACKFILL_PUBLISHED=1`: 559 published rows → 542 updated (505 Tier-1
  direct, 37 Tier-2/3 forced through the resolver: free 5, google 13, motif 19).
- `IMAGE_BACKFILL=1 IMAGE_FORCE=1`: 57 needs_review rows → all 57 updated
  (google 16, motif 41).
- **Verified, read-only, against the live DB:** published catalog photo_source
  counts are `{motif: 524, google: 27, wikimedia: 8}` — zero pexels, zero
  placeholder. (68 pexels rows remain, but only among `draft`/`archived` status
  rows neither backfill targets — invisible to any RLS-scoped reader, matching
  the established minimal-footprint backfill pattern from Phase 0/1.) Spot-
  checked 8 motif rows and 5 big-type rows for correct `visual_kind`/`visual_key`
  pairing; zero rows found with `photo_source='motif'` and a null `visual_kind`
  (the one data-integrity query that would have caught a half-written row).

**Stop-and-show — screenshots at 390×844 and 1280×900, dev server already
running on :3000, real backfilled production data (not fixtures):** Today view
shows the `trail` motif (Volunteer Gardening · Alice Keck Park, outdoor_activity)
and `stage` motif (an arts_theater exhibit) rendering correctly at both widths;
Week view shows `market` motif cards (LOTG | Oak Park, Mah Jongg, D&D — all
community_gathering/family-day) and confirms a real big-type card in situ
("Molly Miller Trio" at SOhO → big "SUN" + gold rule + "downtown — jul 13",
same two-line structure as the mockup's "1873" Lobero card, computed from real
`starts_at`/`neighborhood`, not hardcoded); Month view (RockTile, out of scope)
confirmed still rendering its pre-existing gradient fallback, unbroken. No
console errors, no broken-image glyphs, no two identical adjacent visuals in
what was captured. `tsc --noEmit` and 550/550 vitest clean throughout (10 new
tests in `lib/visualAssignment.test.ts`); eslint shows no NEW errors — the
`any`-typed JSON parsing and two pre-existing `react-hooks/set-state-in-effect`
findings all predate this session (checked against `HEAD`, Phase 0's last real
commit) and are unrelated to this phase's diff.

**Not done, flagged rather than silently decided:** `PEXELS_API_KEY` itself
still needs deleting from Vercel/GitHub secrets by Jim (§7 of the spec — "Jim
deletes the secret"); the enum value `'pexels'` stays in the DB by design
(historical/draft/archived rows, re-resolves on a future touch). No new
migration needed for either.

---

## 2026-07-10 — Card Imagery Phase 3 kickoff (reconciliation + DDL Moment 2, holding for Jim)

Source: `docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md` §6 (Phase 3). Jim
confirmed the Phase 2 stop-and-show approved in this session's kickoff message —
starting Phase 3 (the motif tier + Pexels retirement).

**Reconciliation against live code (§0 Ground Rule 1), findings that change or
add to the spec's plan:**

1. **Schema verified clean.** Live `sbdaymaker_schema.sql`: `photo_source` enum
   is exactly `('pexels','wikimedia','google','owned','placeholder')`, no
   `'motif'` value; `things` has no `visual_kind`/`visual_key`/`visual_seed`
   columns. §6.1's DDL applies verbatim, no name collisions.
2. **`ListCard`'s 108px rail is a structural match for the mockup's card art.**
   `.sbd-listcard__rail` (`components/ui/Card.tsx` / `app/components.css`) is
   108px wide, `align-self:stretch` (full card height), `position:relative` —
   the same shape as the mockup's `.card__visual`. The motif SVG drops in as an
   absolutely-positioned layer inside it, tinted via a background class, exactly
   as built in the mockup. This is the one live card actually rendered on
   Explore/Discover/Saved.
3. **`PickCard` (140px band) is dead code — not wired into Phase 3.** Grepped
   the whole tree: `PickCard` is exported from `components/ui/index.ts` but
   imported nowhere; the only other hits are its own docstring and a mention in
   `DetailPhoto.tsx`'s comment. Motif work targets `ListCard` only. Flagging
   rather than silently reviving or motif-fitting a component nothing renders.
4. **Found, not in Phase 3's scope, flagging rather than silently fixing:**
   `Hero.tsx`'s `.sbd-hero__pick-img` (the 84px hero photo band) has **no**
   gradient/icon/motif fallback today — when `pick.photo_url` is empty it's
   just an empty box (the parent `.sbd-hero__pick`'s flat `--bg` shows through,
   no occasion-gradient, no icon). This is a **pre-existing gap**, not something
   this phase introduces, and `hero_eligible` is a founder-set flag with no
   code-level restriction to photo-bearing things — so a T1/motif-tier thing
   CAN become the hero pick today and would render with a visibly blank image
   band. Not touching this without Jim's word: is a Hero motif fallback in
   scope for this phase, or a follow-up? **Jim's answer: feed cards only —
   Hero's blank-image gap stays a flagged, separate known issue, not built in
   this phase.**
5. **The mockup has 9 motifs, not 8.** Counted every distinct SVG art block in
   `docs/card-imagery/SBDaymaker_Explore_Feed_Mockup_v1.html`: Art Walk
   (gallery/palette), Sunset (sun + waves, `t-sea--golden`), Farmers Market
   (tent + stalls), Inspiration Point (peaks + sun, `t-trail`), Stearns Wharf
   (pier + gulls + a hidden pelican, `t-sea`), Old Mission (twin towers,
   `t-mission`), Chaucer's Books (stacked spines, `t-book`), Topa Topa
   (taproom glass, `t-beer`), Butterfly Beach (waves + sand + a second hidden
   pelican, `t-beach`) — nine. The tenth card (Lobero, `t-wine`) is the **D8
   big-type fallback** ("1873"), not a motif. Per Ground Rule 1, the art file
   is truth over the spec's "8 approved motifs" prose — porting all 9.
6. **Shared SVG defs can't be duplicated per-card.** The mockup's `#grain`,
   `#vig`, `#tremble`, `#tremble2` filters and the `#peli` symbol are declared
   ONCE at the top of the static HTML file and referenced by `url(#id)`/
   `href="#id"` from every card. In the live app, `ListCard` renders many times
   per feed — these defs need to live in exactly one shared place (a single
   inert `<svg>` mounted once, e.g. in the app shell or a `SvgDefs` component),
   not inline per card, or duplicate ids will collide. Confirmed the `<use>`
   elements carry an inline `style="fill:..."` in the source mockup (matches
   the instruction that `<use>` needs it — `currentColor`/class-based fill
   doesn't pierce a `<use>` shadow boundary the same way).
7. **Category → motif mapping isn't 1:1** — the catalog has 16
   `HappeningCategory` values (`packages/shared/types.ts`) and 9 motifs, so
   several categories will share a motif or fall through to the big-type
   fallback. Drafting the actual mapping table is build work, not a DDL
   concern — flagging now so the eventual mapping doesn't read as an
   afterthought.

**DDL (Moment 2) — generated from §6.1, verified against live schema above,
checked in at `supabase/migrations/20260710_card_imagery_phase3_motif.sql`,
presented to Jim as one block, holding here exactly as instructed:**

```sql
alter type photo_source add value if not exists 'motif';
alter table things add column if not exists visual_kind text;   -- 'motif' | 'bigtype' | null
alter table things add column if not exists visual_key  text;   -- motif id, e.g. 'wharf'
alter table things add column if not exists visual_seed integer;
```

**Status: holding for Jim to run the DDL in the Supabase SQL Editor and
confirm.** Have NOT started the motif registry, Card.tsx changes, Pexels
retirement, or any backfill — those depend on the new enum value/columns
existing live, per Ground Rule 3 and this session's own instruction to wait for
confirmation before depending on the DDL.

---

## 2026-07-10 — Card Imagery Phase 2: weak-match nearby-search refinement + embedding lookup in Live Catalog

Source: two follow-up asks after shipping the basic place_id lookup. (1) A better
answer than "skip" for address-only venues. (2) Where to surface lookup in the
Live Catalog tab — asked as an open question first ("options + recommendation"),
answered, Jim confirmed the recommendation (per-thing button only, no
catalog-wide bulk button — a blanket bulk action would auto-create a venue for
every unattached thing in the catalog, including the ~500 Tier-1 events that are
deliberately designed to show NO photo since Phase 0; that would work directly
against a core, intentional product decision, not just be redundant).

**Part 1 — weak-match handling, built exactly as recommended plus the
follow-up automation:**
1. **`isWeakPlaceMatch()`** (`lib/venuePool.ts`) — reuses the existing "starts
   with a digit -> not a venue name" signal from `extractVenueNameFromAddress`
   to detect when Google's Text Search just geocoded a bare address back rather
   than finding a real business.
2. **`searchNearbyNamedPlaces()`** (`ingest/images.ts`, new) — Nearby Search
   (New) at a 75m radius around a weak match's geocoded point, filtering out any
   result that's ITSELF just an address echo. **Verified live before relying on
   it**: a 60m search around "40 E Anapamu St"'s geocoded point correctly
   surfaced "Santa Barbara Public Library" as its first result — confirming the
   whole premise empirically, not just in theory.
3. **`lookup-place-ids` route restructured** — results now bucket into
   `strongMatches` / `weakMatches` (each weak match carries both the bare-address
   match AND any real nearby candidates found) / `noMatches`. Also gained
   `venue_id` (single-venue mode) and `query` (custom search text override, for
   the "search again with a name I already know" retry) parameters — still
   writes nothing; every result is a proposal.
4. **Venues tab UI** — weak matches get their own visually-distinct row: any
   real nearby candidates shown as one-click "Use this" picks, the original
   bare-address match still available as a last resort, PLUS an editable text
   box ("Know the real name? Search again") for a fully custom retry — you
   likely already know these ~5 ambiguous venues by name, so typing it is often
   faster and more reliable than any further automation.

**Part 2 — embedded in Live Catalog, per-thing only (Jim's confirmed choice):**
5. **`CatalogImagePicker.tsx`** — the existing "needs place_id/coordinates"
   prompt (shown when a thing's auto-attached/created venue lacks either) gained
   a **"Look up automatically" button**, scoped to just that one venue via the
   same route's single-venue mode. A strong match pre-fills the place_id/lat/lng
   inputs directly with a confirming note; a weak match pre-fills the bare
   address as a fallback AND shows any nearby real candidates as "Use this"
   picks — same logic as the Venues tab, condensed to fit inline. Nothing
   auto-saves; Jim still reviews and clicks the existing "Save & fetch" button.
   **No catalog-wide bulk button was built** — see the reasoning above; the
   Venues tab's own bulk button already covers every venue that exists, and a
   catalog-wide version would only make sense by auto-creating venues for
   things that were never meant to get one.

**Verification:** `tsc --noEmit` and 540/540 tests clean; dev server unaffected;
`/admin/venues` and `/admin/catalog` both correctly redirect unauthenticated
(same standing limitation — could not click through the actual UI, no admin
session in this environment). The Google API pieces (Text Search, Nearby
Search) were both verified with real live calls before being wired into the
route, not just typechecked.

**Files touched:** `lib/venuePool.ts` (`isWeakPlaceMatch`), `ingest/images.ts`
(`searchNearbyNamedPlaces`), `app/api/admin/venues/lookup-place-ids/route.ts`
(strong/weak/no-match buckets, `venue_id` + `query` params), `app/admin/venues/
VenuesView.tsx` (weak-match UI: nearby picks + editable retry),
`app/admin/catalog/CatalogImagePicker.tsx` ("Look up automatically" button),
`app/admin/review/cockpit.css` (`.weakmatch`/`.weakflag`).

---

## 2026-07-10 — Card Imagery Phase 2: automated place_id lookup

Source: Jim's ask — an as-simple/automated-as-possible way to backfill `place_id`
on the 18 venues (all currently null), maintaining high accuracy. Researched
pricing before building (a dedicated research agent verified Google's current
pricing pages directly, not from training data, matching this project's own
established practice of never guessing at Google API costs) rather than assuming.

**Pricing finding, cited:** the field mask needed (`id` + `location` +
`displayName` + `formattedAddress`) requires Text Search **Pro** tier — Google
bills a whole request at the highest SKU any requested field touches, and
`location`/`displayName` aren't in the free Essentials tier even though `id`
alone would be. Pro: **$32.00/1,000 calls, 5,000 free/month**
(source: developers.google.com/maps/billing-and-pricing/pricing, cross-checked
against the Data Fields (New) table). At this feature's real volume (a one-time
~18-venue pass, then occasional lookups as new venues appear) this is
functionally $0 — nowhere close to the free monthly allowance. Deliberately did
NOT reach for the cheaper Legacy Find Place API ($17/1,000) — it's on Google's
own deprecated migration track, wrong foundation for new production code even at
a lower headline price.

**Built:**
1. **`searchPlaceByText()`** (`ingest/images.ts`, new) — Text Search (New),
   field-mask-limited to the four needed fields, returns only the first (best)
   result. No cap/`image_spend` bookkeeping added for this — deliberately kept
   separate from the photo-fetch spend counter (a different SKU, a much larger
   free allowance, would either falsely tighten the photo cap or misrepresent
   real cost if merged into one counter).
2. **`app/api/admin/venues/lookup-place-ids/route.ts`** (new) — POST, no body:
   queries every active venue missing a `place_id` (`"{display_name}, Santa
   Barbara, CA"`), returns proposed matches (place_id, coordinates, matched
   name/address) AND a list of venues with no good match. **Writes nothing** —
   approving a proposal is a separate call to the existing
   `/api/admin/venues/edit` route, so a bad match can never land unreviewed.
3. **Cockpit UI** (`VenuesView.tsx`) — new "Place ID lookup" section: one button
   runs the batch search; results show as a review list (matched name + address
   per venue) with Approve/Skip, same pattern as "Matches to review." Client-side
   dismiss only (same limitation as the thing-matching pane — no rejection state
   in the additive-only DDL) — a skipped proposal reappears on the next lookup
   run, which is fine given the trivial cost of re-running it.

**Verification — ran the real API, not just typechecked the code (3 live calls,
free tier):** `searchPlaceByText()` tested directly against Google against three
real queries. **"Old Mission, Santa Barbara, CA"** and **"Santa Barbara Bowl,
Santa Barbara, CA"** both resolved precisely — correct names, addresses, and
coordinates closely matching the existing hand-geocoded marquee data (Phase 1's
OSM Nominatim coordinates) — confirming the "landmarks resolve reliably"
prediction. **"1469 E Valley Rd, Santa Barbara, CA"** (one of the address-cluster
venues, no real business name) came back with the matched `name` equal to the
literal address itself — i.e. Google geocoded the address but found no distinct
business/POI there — confirming the OTHER prediction empirically: this class of
venue may "succeed" technically while returning nothing actually useful for
photo-fetching (no business → almost certainly no photos). This is precisely
what the review-before-write step exists to catch; Jim would see this exact
"matched name = the address" pattern in the UI and know to Skip it.

`tsc --noEmit` and 540/540 tests clean; dev server unaffected (cockpit-only
addition, no public-facing change).

**Files touched:** `ingest/images.ts` (`searchPlaceByText`,
`PlaceSearchResult`), `app/api/admin/venues/lookup-place-ids/route.ts` (new),
`app/admin/venues/VenuesView.tsx` (Place ID lookup section + handlers).

---

## 2026-07-10 — Card Imagery Phase 2: Live-catalog "Fetch candidates"/"Fetch via Google"

Source: Jim's ask — bring the Venues tab's photo-fetch capability to the Live
Catalog tab, "very easy to use." Per his own explicit instruction, asked about
the live-catalog-specific nuances BEFORE building (AskUserQuestion, two
questions) rather than guessing at the design — both answered with the
recommended option.

**Decisions confirmed by Jim:**
1. **Storage model: venue-backed, invisible to him.** A Catalog-tab Google/
   Wikimedia photo is NOT stored as a raw URL on the thing — it goes through the
   same `venues`/`venue_photos` system the Venues tab uses, so it inherits the
   7-day refresh, immediate dead-photo detection, Wikimedia auto-fallback, and
   digest notification for free. The alternative (store directly on the thing)
   would have recreated the exact "raw URI, no refresh" gap Phase 2 was built to
   close — flagged clearly before he chose.
2. **Attachment: auto-create a dedicated venue**, no fuzzy-matching guesswork,
   when a thing has no venue yet. Accepted trade-off (his own words, presented
   plainly): may create small single-thing venues that clutter the Venues tab
   over time — mergeable later the same way the SOhO/Bowl duplicates were merged
   earlier this session, not a permanent problem.

**Built, in dependency order:**

1. **`lib/venueFetch.ts`** (new) — `fetchCandidatesForVenue()` extracted from the
   Venues tab's own fetch route (zero behavior change there — it's now a thin
   wrapper) so both cockpit surfaces share ONE Wikimedia-first/Google-override
   implementation instead of two that could drift.
2. **`lib/venuePool.ts`** gained `slugifyVenueKey()` (moved from `ingest/run.ts`,
   re-exported nowhere needed since only the seeding script used it before) — the
   new catalog route needs the same slug logic and **must not import from
   `ingest/run.ts`**, which runs its worker `main()` unconditionally at module
   load (a real landmine: importing anything from that file into an API route
   would execute the nightly ingest job inside a web request).
3. **`app/api/admin/catalog/venue-photos/fetch/route.ts`** (new) — POST
   `{ thing_id, include_google? }`. Attachment logic in order: (a) thing already
   has `venue_id` → reuse it; (b) no `venue_id` but thing's own `place_id`
   EXACTLY matches an existing active venue → attach to that (deterministic
   dedup, not fuzzy — matches what Jim actually approved, not fuzzy matching he
   declined); (c) otherwise auto-create a venue seeded from the thing's own
   title/place_id/lat/lng (whatever it has, even if that's nothing — the picker
   surfaces a prompt to add either afterward). Calls `fetchCandidatesForVenue()`,
   then returns the venue's full current option set (approved pool + fresh
   candidates) as `PhotoOption[]` tagged with `venuePhotoId`, so the existing
   single-photo cycling UI just works unchanged — no new grid component needed
   in the Catalog sheet.
4. **`app/api/admin/catalog/photo/route.ts`** extended — accepts an optional
   `venue_photo_id`; when present and not yet approved, approves it
   (`approved=true` + appended `sort_order`) in the SAME request that applies the
   photo to the thing. A plain Pexels/"find more options" pick (no
   `venue_photo_id`) behaves exactly as before — zero change to that path.
5. **`app/admin/catalog/CatalogImagePicker.tsx`** — replaced the old "Try
   fetching a photo" free-only action (`/api/admin/catalog/find-more-images`,
   left intact and unchanged — still used by `EditionImageEditor.tsx`, NOT
   deleted) with two buttons matching the Venues tab's own pattern exactly:
   "Fetch candidates" (Wikimedia-first, auto-Google-if-thin) and "Fetch via
   Google" (explicit override) — same labels, same behavior, same mental model
   as the Venues tab, deliberately, so Jim learns the pattern once. When the
   (possibly just auto-created) venue has no `place_id`/coordinates yet, an
   inline prompt appears with the same input fields as the Venues editor plus a
   "Save & fetch" button — Jim never has to leave the Catalog sheet or think
   about "venues" as a concept.
6. **`lib/review.ts` / `lib/catalogServer.ts`** — `PhotoOption` gained optional
   `venuePhotoId`; `CatalogRow` gained `place_id`/`lat`/`lng`/`venue_id` (added to
   the catalog `SELECT`) so the picker knows the thing's current attachment state
   without a second round trip.

**Known minor cosmetic overlap, not fixed:** `ImagePicker`'s own built-in
"Try fetching a photo" button (shown only when a thing has zero photo_options at
all) is now wired to the same `doFetch(false)` action as the new "Fetch
candidates" button — in the rare all-empty case, both appear and do the same
thing. Harmless (identical action, not a conflict), not worth forking
`ImagePicker`'s shared behavior (also used by the Queue) over.

**Verification:** `tsc --noEmit` and 540/540 tests clean. Dev server unaffected
(only cockpit-only files touched); `/admin/catalog` correctly redirects to
`/cockpit/login` unauthenticated, same as every other admin route — could not
click through the actual fetch/apply flow myself (no admin session in this
environment, the same recurring limitation). Asking Jim to test-drive this one
directly: open the Live catalog, edit a published thing, click "Fetch
candidates," confirm photos appear and "Use this photo" applies instantly.

**Files touched:** `lib/venueFetch.ts` (new), `lib/venuePool.ts`
(`slugifyVenueKey` added), `ingest/run.ts` (`slugifyVenueKey` now imported, not
locally defined), `app/api/admin/venues/photos/fetch/route.ts` (thinned to use
the shared helper), `app/api/admin/catalog/venue-photos/fetch/route.ts` (new),
`app/api/admin/catalog/photo/route.ts` (`venue_photo_id` approve-on-apply),
`app/admin/catalog/CatalogImagePicker.tsx` (new fetch buttons + location
prompt), `app/admin/catalog/CatalogView.tsx` (new props +
`applyVenueId` sync), `lib/review.ts` + `lib/catalogServer.ts`
(`PhotoOption.venuePhotoId`, `CatalogRow` place_id/lat/lng/venue_id),
`app/admin/review/cockpit.css` (`.catphoto-fetchrow`/`.catphoto-location`).

---

## 2026-07-10 — Card Imagery Phase 2: "Fetch via Google" greyed-out UX fix (not a bug)

Jim reported every "Fetch via Google" button greyed out and unclickable. Confirmed
live (read-only query): correct behavior, not a bug — **zero of the 18 active
venues have a `place_id` set** (Google fetching requires one; seeding never
populates it, per the 2026-07-10 finding earlier the same day). The button's
disabled-reason was only a hover `title` tooltip — invisible unless you happen to
hover exactly there, which is why this read as broken rather than as a data gap.
Fixed the VISIBILITY, not the logic: an always-shown warning line now sits right
under the buttons whenever `place_id` is missing, and a second line if
coordinates are ALSO missing (so "Fetch candidates" itself is disabled too) —
both point at the editor fields directly above them.

**Verification:** `tsc --noEmit` and 540/540 tests clean.

**Files touched:** `app/admin/venues/VenuesView.tsx` (persistent inline warning
replacing/supplementing the hover-only tooltip).

---

## 2026-07-10 — Card Imagery Phase 2: closing verification (§5.6's own "poison one URL in dev" acceptance test, actually run)

Source: spec §5.6's own acceptance criteria ("broken-image fallback verified by
poisoning one URL in dev") — never actually executed until now; every prior claim
that the onError fallback "works" was reasoning from the code, not observation.
Jim asked "are we done with this phase" — this is the verification that should
have closed it out properly, run before answering yes.

**Method:** Playwright against the dev server (already running on :3000, reused
rather than spinning up a second instance), intercepting a REAL Google photo
request (Corks n' Crowns, a real published thing) and aborting it client-side —
zero production data touched, unlike the two earlier attempts this session to
mutate a live thing's `photo_url` directly, both correctly blocked by the
session's own auto-mode safety classifier as unauthorized live-data mutation.

**Found: a real gap.** The thing detail page (`app/(app)/thing/[id]/page.tsx`)
renders its own `<img>` directly — it does NOT go through `ListCard`/`PickCard`
(`components/ui/Card.tsx`) or `Hero.tsx`, so the `onError` fallback built earlier
this session never reached it. The poisoned photo showed the browser's native
broken-image glyph in the corner of the gradient box — small, but a real,
visible defect the spec's acceptance criterion exists to catch. **Fixed:**
extracted `components/detail/DetailPhoto.tsx` (new, `"use client"`, matching the
existing `BackButton`/`DetailSaveButton` small-client-island pattern already used
on this page) using the SAME `usePhotoFallback` hook from `Card.tsx` (exported for
reuse, not duplicated) — the detail page now has the identical fallback.

**Found, and NOT "fixed" — a real, honestly-disclosed limitation of the onError
approach itself, discovered while re-verifying the fix:** the first re-test still
showed the broken-image glyph. Isolated the cause with a second test (dispatching
a synthetic `error` event on the ALREADY-HYDRATED image, well after normal page
load) — that one worked correctly (the image was removed, gradient shown),
proving the component's logic is right. The failure is a **hydration race**: on
a fresh, server-rendered page load, the browser starts requesting the `<img>`
from the raw HTML before React's client bundle has downloaded/parsed/hydrated
enough to attach the synthetic `onError` listener. Playwright's `route.abort()`
fails a request almost instantly, exaggerating this race far beyond what a real
dead URL over a real network would do — but the race is real, not just a test
artifact, on a slow device/connection. **Deliberately not "fixed" further** —
switching to `next/image` (which handles this more robustly) is a materially
bigger architectural change (remote-domain config, layout-shift behavior) than
this narrow edge case justifies, and isn't something to decide unilaterally.
**Why this is an acceptable residual risk, not a real gap in coverage:** the
onError handler is DEFENSE IN DEPTH, not the primary defense — the primary
defense is the nightly server-side detection + auto-fallback built the same day
(now reacting immediately to a confirmed-dead Google photo), which exists
specifically to keep a truly-dead URL from sitting in the database for long
enough that a real visitor would ever load it fresh. The onError handler reliably
catches everything EXCEPT the narrow "already-dead at the exact moment of a fresh
SSR page load, losing a timing race" case — it correctly catches a URL dying
while a user is already on the page, and any client-side navigation to the page
(no fresh-SSR race in that path). Flagging this nuance rather than overclaiming
"fully verified" the way the original build summary implicitly did.

**Verification:** `tsc --noEmit` and 540/540 tests clean; dev server unaffected
(only the detail page's photo rendering changed).

**Files touched:** `components/ui/Card.tsx` (`usePhotoFallback` exported),
`components/detail/DetailPhoto.tsx` (new), `app/(app)/thing/[id]/page.tsx` (uses
`DetailPhoto` instead of its own inline `<img>`).

---

## 2026-07-10 — Card Imagery Phase 2 addendum: 7-day refresh cadence + automated dead-photo fallback + digest notification

Source: Jim's follow-up questions on §5.5. Two distinct asks: (1) confirm whether
any automated dead-link check existed before this (it didn't — see below), and
(2) build Option 1 from the cap-math discussion (stretch the refresh interval to
7 days) PLUS a real detection/fallback/notification pipeline, since a longer
interval alone just widens the silent-staleness window without Jim ever knowing.

**What existed before this addendum, stated plainly (this was the honest answer to
Jim's question):** the nightly refresh only ever SUCCEEDED silently or FAILED
silently — a failed refresh attempt just left the row's old serving_url in place
forever, logged to a console line in the GitHub Action's own run output (which
Jim would only ever see by opening that day's Action log manually), with no
digest mention and no distinction between "one transient blip" and "this photo is
actually gone." The client-side onError→gradient handler (already built) covers a
real user's browser hitting a dead link in the moment, but that event was never
recorded or surfaced anywhere either. So: no manual review was ever required for
the refresh itself to run (it's fully automatic), but there was no founder-facing
signal when something actually broke — a real gap, now closed.

**Built:**

1. **`REFRESH_STALE_HOURS` 20h → 168h (7 days)** — Option 1 from the cap-math
   discussion. Worst case (18 venues × 5 Google photos, all assigned) drops from
   ~2,700/month to **~386/month**, comfortably under the 500/mo cap even at that
   pessimistic ceiling — no cap raise needed, no curation restriction.
2. **`CONFIRMED_DEAD_HOURS` (new, = 2× the refresh interval = 14 days)** —
   distinguishes a transient failure (network blip, momentary Google API issue)
   from a genuinely dead photo. A row that fails to refresh is just retried on the
   next scheduled attempt; only once a row has gone a FULL 14 days with no
   successful refresh does it get treated as confirmed dead and handed to the new
   fallback path — a single bad night never triggers a reassignment.
3. **`handleDeadVenuePhoto()` (new)** — on confirmed-dead: deletes the dead
   `venue_photos` row (freeing its pool slot), searches Wikimedia for the venue
   using the exact same gate/scorer the resolver and cockpit's "Fetch candidates"
   already share (`wikimediaGeosearch` + `rankWikimediaCandidates` — never a
   separate, weaker check), and auto-approves the best surviving candidate into
   the freed slot if one exists (deduped against the venue's existing pool so it
   never re-adds something already there). Every `things` row currently displaying
   the dead photo is updated to the replacement — or reset to the gradient
   placeholder if no strong Wikimedia candidate was found. **"Motif" is explicitly
   NOT part of this fallback chain** — it's a Phase 3 feature (new DDL, an SVG art
   library) that hasn't been started; today's chain is Google → Wikimedia →
   gradient. Once Phase 3 ships, the gradient step is superseded automatically
   without touching this code (motif sits between Wikimedia and gradient in the
   priority table either way).
4. **Digest notification (`ingest/digest.ts`)** — `DigestSummary` gained an
   optional `venueFallbacks: VenueFallbackEvent[]` field; the nightly email (which
   already exists and already reaches Jim via the `DIGEST_TO` GitHub secret — Phase
   13) now includes a "📷 Venue photo(s) replaced" line per fallback event
   (venue name → "Wikimedia (auto-approved stand-in)" or "gradient (no strong
   Wikimedia candidate found)") plus a "Review venue photos →" button linking
   straight to `/admin/venues`, mirroring the existing failed/held-edition alert
   pattern in the same email. **Auto-approving the Wikimedia stand-in (not queuing
   it as an unapproved candidate) was a deliberate call**, matching how Wikimedia
   auto-picks already work everywhere else in this app outside the Phase 2 pool
   system (resolveImages() picks Wikimedia for T2/T3 places with zero founder
   gate) — paired with an unconditional notification so Jim can re-review and
   replace it himself, exactly as he asked, rather than leaving the site showing a
   dead/gradient card while waiting on a founder click that might not come for
   days.
5. **Not verified directly:** whether the `DIGEST_TO` GitHub secret is actually
   set — no `gh` CLI/token access in this environment (the same recurring gap).
   The code path is correctly wired (`secrets.DIGEST_TO` in
   `.github/workflows/ingest.yml`); if Jim's existing nightly digest emails have
   been arriving (a pre-existing Phase 13 feature, not new), this section will
   just start appearing in them the first time a fallback actually fires.

**Verification:** `tsc --noEmit` and 540/540 tests clean. No live fallback event to
demonstrate yet (zero approved Google photos exist in production today — nothing
has had the chance to go stale).

**Files touched:** `ingest/run.ts` (`REFRESH_STALE_HOURS`/`CONFIRMED_DEAD_HOURS`
constants, `handleDeadVenuePhoto()`, `refreshVenuePhotoServingUrls()` restructured
to detect-then-fallback, `venueFallbacks` threaded to `sendDigest`), `ingest/
digest.ts` (`VenueFallbackEvent` type, digest email section + button).

**2026-07-10, same day — Jim pushed back on the 14-day wait: "can't we fall back
immediately whenever an image is actually dead?"** Correct instinct, and yes for
the common case. The original design treated every refresh failure identically
(a blip and a real death looked the same), which is why it waited. Fixed at the
root: `refreshGoogleMediaUri()` (`ingest/images.ts`) now returns a discriminated
result — `'not_found'` specifically for a real HTTP 404 from Google's media
endpoint (the photo resource itself is confirmed gone: removed by the business,
pulled by Google's moderation, or the place closed), vs. `'error'` for everything
else (rate limits, 5xx, network errors, an ambiguous 403 that could just as
easily be an API-key/billing problem as a dead photo). The refresh loop now
reacts to `'not_found'` IMMEDIATELY on the very first attempt, no waiting at all
— this is the common real-death case. `CONFIRMED_DEAD_HOURS` (14 days) is now
strictly a backstop for the AMBIGUOUS `'error'` case only: reacting instantly to
those risks a false-positive mass-reassignment (e.g. a billing hiccup would make
many unrelated Google photos fail at once in the very same run — that's a
configuration problem to go fix, not a sign that hundreds of venues suddenly need
new photos), so that case still waits out two full refresh cycles before
concluding the photo is actually gone rather than just Google (or our own key)
having a bad day.

**Verification:** `tsc --noEmit` and 540/540 tests clean; dev server unaffected.

**Files touched (this addendum):** `ingest/images.ts` (`GoogleRefreshResult`
discriminated type, `refreshGoogleMediaUri()` inspects the HTTP status),
`ingest/run.ts` (refresh loop branches on `'not_found'` vs `'error'`).

---

## 2026-07-09 — Card Imagery Phase 2 (venue registry, photo pools, compliant Google refresh)

Source: `docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md` §5 (Phase 2). Continues
from the DDL-handoff entry directly below, after Jim confirmed he ran
`supabase/migrations/20260709_card_imagery_phase2_venues.sql` — verified live before
building anything on top of it (see that check under "DDL verification" below).

**DDL verification (before building anything on top of it):** live read-only checks
confirmed `venues`, `venue_photos`, and `things.venue_id` all exist, and a throwaway
insert/update/delete round-trip confirmed `trg_venues_updated` actually fires. Clean
to proceed.

**Built, in dependency order:**

1. **`lib/geo.ts`** (new) — `haversineMeters` relocated here from
   `ingest/marqueeVenues.ts` (re-exported from there unchanged, zero call-site
   changes) so both `ingest/` and app-side `lib/venuePool.ts` can share one
   definition — `lib/` can't import from `ingest/` (one-way dependency), so the
   shared math had to live on the `lib/` side.

2. **`lib/venuePool.ts`** (new, 16 unit tests) — the pure, testable core of this
   phase, importable by both the ingest resolver and the app/cockpit:
   - `pickFromPool(thingId, isoDate, poolLen)` — deterministic `hash(thing_id+date) %
     poolLen` rotation (§5.4).
   - `dedupeFeedVenuePhotos(items, pools)` — the per-feed dedupe pass. Only
     reassigns a card whose CURRENT photo is actually a member of its venue's
     approved pool (`pool.some(p => p.url === item.photo_url)`) — a card resolved
     some other way (direct-Google food, a founder's one-off "find more options"
     pick) is left untouched even if it shares a `venue_id`. This is the safest
     available proxy for spec §5.4's "founder per-thing picker overrides always win
     over rotation," given there's still no `photo_locked` column (the same
     pre-existing gap Phase 0/1 already flagged) to check directly.
   - `scoreVenueMatch` / `bestVenueMatch` — the fuzzy thing→venue matcher scoring
     for the cockpit's "matches to review" pane and the seeding script's own
     dedupe-against-already-known-venues pass.
   - `extractVenueNameFromAddress` — pulls a venue name from a leading
     comma-separated address segment when it doesn't itself look like a street
     address (starts with a number); used only by the seeding script.

3. **Resolver integration (`ingest/images.ts`)** — a new priority-2 "DB venue pool"
   check, evaluated BEFORE the existing Phase 1 marquee file-pin: batch-loads every
   active venue + its approved photo pool once per run (`loadVenuePools`), matches a
   candidate to a venue via `matchVenueForCandidate` (either an ALREADY-SET
   `c.venue_id` from a founder-approved fuzzy match, or a fresh EXACT `place_id`
   hit — never a fresh fuzzy guess inside the resolver itself), and on a pool hit
   uses `pickFromPool` for today's pick with `skipRelevance=true` (founder-curated,
   same rationale as the marquee pin). The marquee file-pin path is unchanged and
   still checked as the fallback — in practice these two "venue pool" mechanisms
   will converge once a marquee entry (e.g. `sb-bowl`) gets real cockpit-curated
   photos, at which point the DB path fires first and the file-pin path stays the
   dead no-op it already was. The cache-hit fast path now also computes the venue
   match BEFORE deciding whether to skip fresh resolution — a candidate whose
   matched venue has an approved pool always gets freshly evaluated (pure,
   free, no network cost) even on what would otherwise be a cache hit, so a
   newly-curated pool takes effect on the very next run rather than waiting for the
   place-level cache to expire or a forced backfill.
   - `venue_id` added to `Candidate` (`packages/shared/types.ts`) and `Thing`
     (`lib/things.ts` + its `BASE_COLS`/`mapThing`) — only ever set on an exact
     `place_id` match (never a fuzzy guess), persisted at land time
     (`ingest/land.ts`'s `toThingRow()`) and threaded through all four existing
     image-backfill functions in `ingest/run.ts` (select + Candidate mapping +
     `.update()`) so a re-resolve pass doesn't lose an already-approved venue
     attachment.

4. **Venue registry seeding (`ingest/run.ts`'s `seedVenueRegistry()`, `VENUE_SEED=1`,
   new `.github/workflows/ingest.yml` input) — RUN FOR REAL this session** (see
   "Seeding run results" below), not just built. Two sources, both additive to
   `venues`, both idempotent (upsert on `key`):
   - The 12 `marqueeVenues.ts` entries, imported verbatim (spec's own instruction —
     "DB becomes runtime truth").
   - Tier-1 event address clusters (≥3 events): spatial (haversine ≤75m, spec's
     exact number) when lat/lng exist, else a normalized-exact-address-string
     fallback bucket; a cluster that already scores a match against an
     already-inserted venue (marquee or an earlier cluster this pass, via
     `bestVenueMatch`) is skipped rather than duplicated. Display name is extracted
     from the address's leading segment when it reads as a venue name (`extractVenueNameFromAddress`), else the raw address, title-cased — a rough first
     draft, correctable via the cockpit's venue editor.
   - **Nightly matcher (`matchVenuesByPlaceId`, wired into `main()`'s regular
     always-on flow, isolated try/catch)** — spec's own "runs nightly for new
     things: exact place_id match auto-attaches." Fuzzy matches are NOT persisted
     anywhere (no queue table exists in the additive-only Phase 2 DDL) — they're
     computed live by the cockpit's own query every time the Venues tab loads.

5. **Nightly compliant Google URI refresh (`refreshVenuePhotoServingUrls`, wired
   into `main()`'s always-on flow)** — scoped exactly per spec §5.5's own mandated
   resolution: only `venue_photos` rows (`source='google'`, `approved`) that are the
   CURRENT pick for at least one visible thing right now (`assignedUrls` computed
   from `things.photo_url`, not the whole pool), refreshed only when `refreshed_at`
   is missing or ≥20h old. **Correctness fix beyond spec's literal text:** a refresh
   updates `venue_photos.serving_url` AND propagates the new URL to every
   `things.photo_url` currently pointing at the old one — the spec's text only
   mentions updating `venue_photos`, but `things.photo_url` is a snapshot copied at
   resolve time, not a live join; without this propagation the refresh would update
   the pool row while every thing displaying it kept silently serving the
   soon-to-expire old URI. Shares the exact `image_spend` cap counter the resolver
   uses (now exported: `monthKey`/`loadSpend`/`saveSpend`/`CAP`) — over-cap rows
   keep yesterday's URI and are logged, per spec's own words, never silently
   overspent or silently dropped. Alerts at >20% failure rate (spec's threshold).
   **Explicitly out of scope, flagged not silently patched:** the ~14 legacy direct-
   Google food/drink `things` rows from Phase 1 §4.5 store only a raw `photoUri`, no
   photo-resource-name column — the Phase 2 §5.1 DDL Jim ran adds `stable_ref` only
   to `venue_photos`, not to `things`. Refreshing them would need a fresh Place
   Details call every time (2 calls, not 1), not the pattern this step builds.
   §4.5 already called this "acceptable for days, not months"; a real fix is
   migrating them into venue-backed pools (each becomes a venue with a curated
   1-photo pool), which needs founder photo approval like anything else in this
   phase — not done unilaterally. Flagging for Jim, not silently left to rot: these
   14 rows' `photo_url`s will keep aging until either curated into a venue or a
   future session adds the missing column.

6. **Cap math for §5.5 — the real numbers, brought to Jim rather than deciding
   unilaterally (per the kickoff's own instruction):** today's real refresh cost is
   $0/0-calls (zero `venue_photos` rows exist yet — nothing curated). But the
   spec's own worst-case sizing note flagged this cadence as potentially not
   fitting the 500/mo cap even at the narrower "assigned, not whole pool" scope
   (spec's own estimate: ~40–80/night ≈ 1,200–2,400/month, vs. the 500/mo cap). This
   session's real seed produced 21 active venues (12 marquee + 9 clusters, see
   below). If EVERY venue gets a 3–5-photo Google-sourced pool and, over a 45-day
   event window, most/all pool photos end up "assigned" to at least one thing
   (pigeonhole, once a venue hosts enough events) — worst case ≈ 21 venues × 4
   photos ≈ 84 refreshes/night ≈ 2,520/month, ~5× the cap. **This does not fit, and
   I'm not deciding a workaround unilaterally — options for Jim:** (a) raise
   `IMAGE_MONTHLY_CALL_CAP` for this specific use (it's a runaway guard, not a true
   dollar cap — real refresh cost is ~$7/1,000 per the Phase 1 pricing finding, so
   even 2,500/month ≈ $17.50, well inside the ~$45–95/mo cost envelope); or (b)
   curate pools Wikimedia-first — Commons URLs never expire, so a venue's pool
   costs ZERO ongoing refresh unless Wikimedia genuinely has nothing usable for it
   (the cockpit's "Fetch candidates" already surfaces both side by side, so this is
   a curation preference, not a code change). Recommend (b) as the practical
   default and (a) only where a venue's best real photo is Google-only. Not
   deciding this myself either way.

7. **Cockpit Venues tab** (`app/admin/venues/page.tsx` + `VenuesView.tsx` +
   `lib/venuesServer.ts`, added to `CockpitTabs.tsx` — **the sixth tab**, per the
   stale-count note in the DDL-handoff entry below) — three panes per spec §5.3:
   - **Matches to review:** every unattached published/needs_review thing scored
     against every active venue (`bestVenueMatch`), best match surfaced, sorted by
     score. Approve writes `venue_id` (`/api/admin/venues/match`) and — new,
     beyond spec's literal text but clearly implied by "founder-approved pool" —
     immediately applies today's `pickFromPool` result if the venue already has an
     approved pool, so the founder sees the photo change right away instead of
     waiting for the next nightly run. "Not a match" is a CLIENT-SIDE dismiss only
     (`useState<Set>` in `VenuesView.tsx`) — **judgment call:** the additive-only
     Phase 2 DDL has no rejection-tracking table, so there's nowhere to persist a
     reject; the same proposal will resurface on a future page load unless
     approved or the venue's `name_patterns`/`radius_m` are adjusted to stop
     matching it. Flagging, not silently building a table beyond what Jim already
     approved.
   - **Photo pools:** "Fetch candidates" (`/api/admin/venues/photos/fetch`) pulls up
     to 10 Google photos (`fetchGooglePhotoCandidates`, new — 1 free Place Details
     call + up to 10 billable preview media calls, cap-checked mid-loop via a
     `hasBudget()` callback) plus top-5 gated Wikimedia geosearch results
     (`wikimediaGeosearch` exported, `rankWikimediaCandidates` — a new pure
     top-N ranker refactored out of the existing `pickBestWikimedia` so both share
     one gate/scorer, no forked logic), persisted as unapproved `venue_photos` rows
     deduped on `(venue_id, stable_ref)`. Approve/Reject/Reorder are separate
     scoped routes; **Reject is a hard DELETE** (no `rejected` state exists in the
     DDL — an unapproved row is invisible to the public regardless of RLS, so
     deleting is equivalent to hiding, and it also frees the `(venue_id,
     stable_ref)` slot for a future re-fetch).
   - **Venue editor:** rename, adjust radius, archive (`/api/admin/venues/edit`).
     No `name_patterns` free-text editor UI yet (the field is settable via the API,
     just no input box in `VenueDetailSheet` — scope cut for time; the seeding
     script's own merge-fix, below, needed this exact capability and hit the
     auto-mode safety gate instead of a UI gap).

8. **Per-feed dedupe wiring — one real deviation from the spec's literal
   architecture assumption, adapted per ground rule 1.** Spec §5.4 says "Explore/
   Discover feed assembly, SERVER-SIDE." The live Explore feed's final render order
   (lens filter, Near Me sort, cascade) is actually computed CLIENT-SIDE, inside
   `ExploreClient.tsx`'s `useMemo` — a server-side dedupe pass would run on the
   wrong (pre-filter/pre-sort) array and get scrambled again by the client-side
   reorder afterward, defeating the purpose. Adapted: the dedupe pass runs inside
   `CascadeFeed.tsx` itself (client component, shared by both Explore and Discover
   guide pages), applied once to the exact array about to render, via a new
   `venuePools: Record<string, PoolPhoto[]>` prop threaded from a new public
   read (`lib/venues.ts`'s `getVenuePhotoPools()`, anon-key/RLS-gated like
   `getPublishedThings()`) fetched in `app/(app)/page.tsx` and
   `discover/[id]/page.tsx`. Discover's own assembly IS server-side as spec
   assumed, but since `CascadeFeed` does the dedupe internally regardless of
   caller, one code path correctly covers both surfaces.

9. **Broken-image fallback (§5.5 "fallback resilience")** — `components/ui/Card.tsx`
   (`ListCard`/`PickCard`) and `components/explore/Hero.tsx` each gained
   `"use client"` (matching the existing precedent of `CardActions.tsx`, which
   already does this specifically to hold local state even though it's always
   nested in an already-client tree) plus an `onError` handler that hides the
   `<img>` and reveals the existing occasion-gradient background underneath
   (already unconditionally present, not a new fallback element) — resets whenever
   the photo URL itself changes so a fresh pick gets its own chance to load rather
   than inheriting a prior URL's failure.

**Seeding run results (this session, real, not a demo):** `VENUE_SEED=1` run against
the live DB produced **21 active venues** — the 12 marquee entries + 9 proposed
address clusters (`1070-fairway-rd`, `1122-n-milpas-st`, `1221-state-st`,
`1469-e-valley-rd`, `40-e-anapamu-st`, `855-linden-ave`, `los-ba-os-del-mar`,
`santa-barbara`, `soho-restaurant-music-club`). Zero photos, zero founder
approvals — every `venue_photos` row still has to come from a real cockpit click;
nothing here is fabricated curation.

**Data-quality issues found in the seed's own output, flagged for Jim rather than
fixed unilaterally (a fix attempt was correctly blocked by this session's own
auto-mode safety classifier — deleting/merging live venue rows on my own judgment
of what's "bogus" is exactly the kind of call that should be surfaced, not
decided):**
- `santa-barbara` (28 events) is a **false-positive venue** — its address
  normalizes to the bare string "Santa Barbara, Santa Barbara, CA" (no real
  specific location), covering unrelated things (a July 4th event, a piano
  concert, two city-commission meetings). Recommend: archive or delete via the
  cockpit's venue editor — it can't meaningfully hold a curated photo pool.
- `1221-state-st` (51 events, bare address, no venue name) and
  `soho-restaurant-music-club` (7 events, address prefixed with the venue name) are
  **the same real venue (SOhO)**, split into two because the source adapters are
  inconsistent about whether they prefix the venue name into the address string,
  and neither row carries lat/lng to spatially merge them. Recommend: pick one
  (`soho-restaurant-music-club` reads better), add `"1221 state st"` to its
  `name_patterns` so all 58 events fuzzy-match to it, then archive/delete the
  other via the venue editor.
- `1122-n-milpas-st` (10 events, bare address) is **the same venue as the marquee
  `sb-bowl`** — the other two SB Bowl address variants ("santa barbara bowl,
  1122 n. milpas street..." / "...1122 n milpas st...") correctly matched the
  marquee entry by name and were never proposed as duplicates; this bare-address
  variant has neither the venue name nor coordinates, so it slipped through.
  Recommend: add `"1122 n milpas"` to `sb-bowl`'s `name_patterns`, archive/delete
  this one.
- General root cause, for the record: this one-off clustering pass is a rough
  first draft by design (documented in the function's own comment before this run
  happened) — it will not catch every real-world duplicate when lat/lng is
  missing and the address string itself doesn't carry the venue name. The venue
  editor exists precisely so Jim can correct these; I'm not pre-empting that by
  guessing which merges are safe on data I seeded moments ago.

**SOhO-style repetition demo (§5.6) — code-level, not live-production, and I want to
be upfront about why:** no venue has an approved photo yet (curation is a founder
action via the cockpit, not something to fabricate on Jim's behalf — the same
reasoning already applied to marquee pins in Phase 1). Ran a demo against the
`dedupeFeedVenuePhotos` pure function using SOhO's own REAL live event titles (Molly
Miller Trio, James McMurtry w/ BettySoo, a July 4th Salsa Night, Jah Ollin, and a
Morillo/Hatfield/Mycelial bill) against a representative 3-photo pool: the
ingest-time picks collapsed to 2 distinct photos (a real hash collision, as
expected with 5 events over 3 slots); after the per-feed dedupe pass, exactly 3
distinct photos were used and the remaining 2 events correctly fell to the gradient
rather than repeating a 4th/5th time — matching §5.6's acceptance criterion
verbatim. The mechanism is proven; a live, real-photo version of this same demo
needs Jim to actually curate at least one venue's pool first (or explicitly
authorize a bounded stand-in curation, which wasn't assumed here).

**Verification:** 540/540 vitest tests passing (16 new in `lib/venuePool.test.ts`:
`pickFromPool` determinism/range/rotation, the SOhO-style dedupe scenario +
exhaustion + founder-override-is-untouched + no-pool-no-op, venue-match scoring
fixtures, address-name extraction). `tsc --noEmit` clean on every touched file
(remaining noise is entirely the pre-existing stray `" 2"`-suffixed iCloud-sync
duplicate files, untouched, predating this session). Screenshots captured against
the dev server already running on `localhost:3000` (not spun up fresh — reused
rather than risk a second instance colliding) at 390×844 and 1280×900: Explore
Today/Month and a Discover guide page all render with zero console errors, zero
Pexels, existing gradient-fallback behavior for Tier-1 events fully intact — the
venue-pool/dedupe code paths are correctly inert today (no approved photos exist
yet) with no visible or behavioral change to the public site. Also confirmed the
DDL trigger fires (a throwaway venue insert/update/delete round-trip, cleaned up
immediately).

**Status: code complete, seeded, verified — holding here, exactly as instructed.**
Have NOT begun Phase 3 (motif tier / Pexels retirement). Waiting on Jim for: (1) the
§5.5 cap math decision above, (2) the three venue-merge data-quality fixes above,
and (3) approval of this stop-and-show before any further work.

**Files touched:** `lib/geo.ts` (new), `lib/venuePool.ts` + `lib/venuePool.test.ts`
(new), `lib/venues.ts` + `lib/venuesServer.ts` (new), `lib/things.ts`
(`venue_id`), `lib/explore.test.ts` + `lib/savedView.test.ts` (fixture fix),
`packages/shared/types.ts` (`Candidate.venue_id`), `ingest/images.ts` (venue-pool
resolver priority, `fetchGooglePhotoCandidates`, `refreshGoogleMediaUri`,
`rankWikimediaCandidates`, exported spend-counter internals), `ingest/land.ts`
(`venue_id` at land time), `ingest/run.ts` (`seedVenueRegistry`,
`matchVenuesByPlaceId`, `refreshVenuePhotoServingUrls`, `VENUE_SEED` +
`venue_id`-threading through all four backfills), `ingest/marqueeVenues.ts`
(`haversineMeters` re-export from `lib/geo.ts`), `.github/workflows/ingest.yml`
(`venue_seed` input), `app/admin/venues/` (new: `page.tsx`, `VenuesView.tsx`),
`app/admin/CockpitTabs.tsx` + `app/admin/layout.tsx` (Venues tab),
`app/api/admin/venues/` (new: `route.ts`, `match/route.ts`,
`photos/{fetch,approve,remove,reorder}/route.ts`, `edit/route.ts`),
`app/admin/review/cockpit.css` (Venues tab styles), `components/explore/
CascadeFeed.tsx` + `ExploreClient.tsx` + `Hero.tsx` (venue pools prop, per-feed
dedupe, broken-image fallback), `components/ui/Card.tsx` (broken-image fallback),
`app/(app)/page.tsx` + `app/(app)/discover/[id]/page.tsx` (venue pools fetch).

**2026-07-10, same day — Jim's answers to the four open items above, and two
follow-up changes:**

1. **Cap-math question, answered:** Jim asked how many site visitors would be
   needed to generate 2,500 refresh calls/month. Answer: **none — user/visitor
   traffic has zero relationship to this cost.** The nightly refresh
   (`refreshVenuePhotoServingUrls`) is a fixed GitHub Actions batch job that runs
   once per night regardless of how many people load the site; its call count is
   driven entirely by CONTENT (how many venues get Google-sourced approved photos
   × how many of those are "assigned" to a visible thing), never by pageviews. This
   is a deliberate property of the architecture (§2's "resolve once, serve a cached
   URL" pattern, same reasoning as the $45–95/mo flat-cost floor in CLAUDE.md §2) —
   worth recording since it's easy to mistake a per-night batch cost for a
   per-request one. Concretely: ~30 calls/photo/month at the 20h refresh cadence,
   so the 500/mo cap sustains roughly 16–17 actively-assigned Google pool photos
   before any other Google usage (food-set, venue curation fetches) — a curation
   ceiling, not a traffic ceiling.
2. **"Follow your recommendation" (Wikimedia-first curation) — built, not just
   noted.** `app/api/admin/venues/photos/fetch/route.ts`: Wikimedia is now always
   fetched first (free, no cap impact); Google only auto-fires when Wikimedia
   returns fewer than `WIKIMEDIA_SUFFICIENT_COUNT` (3) candidates. When Google is
   skipped for this reason, the response flags `googleAvailableButSkipped: true`
   and the cockpit (`VenuesView.tsx`) surfaces a distinct, deliberate "Also fetch
   Google photos" button rather than fetching it automatically — Google stays one
   click away, it's just no longer the default. `include_google: true` in the
   request body forces it regardless (used by that button).
3. **The three duplicate/bogus venues — resolved, with Jim's explicit per-venue
   confirmation** (an AskUserQuestion round after the auto-mode classifier
   correctly blocked the first two attempts — a general "help me resolve" wasn't
   specific enough authorization for a live-DB delete/merge, by design). Re-checked
   zero attached things / zero photos immediately before writing, then: deleted
   `santa-barbara` (bogus generic-address venue); merged `1221-state-st`'s 51
   events into `soho-restaurant-music-club` by adding `"1221 state st"` to its
   `name_patterns`, then deleted the duplicate; merged `1122-n-milpas-st`'s 10
   events into the marquee `sb-bowl` venue by adding `"1122 n milpas"` to its
   `name_patterns`, then deleted the duplicate. **18 active venues remain** (down
   from 21), each a genuinely distinct real place.
4. **The missing `stable_ref` column for the 14 legacy direct-Google food rows —
   acknowledged by Jim, no action taken.** Left exactly as flagged: those rows keep
   aging until either curated into a venue (their own `stable_ref` would then live
   in `venue_photos`) or a future session adds the column via a new founder-run
   migration.

**Verification:** `tsc --noEmit` and 540/540 vitest tests clean after both code
changes. Confirmed live: 18 active venues (down from 21) via a direct read-only
query; Explore still renders 200 with no behavior change (no photos were touched by
either the merge or the fetch-policy change — the merge only ever touched empty
venue rows, and Wikimedia-first only changes what a FUTURE "Fetch candidates" click
does).

**Files touched (this addendum):**
`app/api/admin/venues/photos/fetch/route.ts` (Wikimedia-first + `include_google`),
`app/admin/venues/VenuesView.tsx` (Also-fetch-Google follow-up action). Venue-table
edits were live data operations (delete + name_patterns update), not code changes —
no file diff.

**2026-07-10, later same day — Jim asked where "fetch Google instead" actually
surfaces, which exposed a real gap: the venue editor had no way to SET a
`place_id` or coordinates at all.** Checked live: none of the 18 venues carry a
`place_id` (Google fetching needs one; it's never auto-populated by seeding or the
marquee registry), and 6 of them (`1070-fairway-rd`, `1469-e-valley-rd`,
`40-e-anapamu-st`, `855-linden-ave`, `los-ba-os-del-mar`,
`soho-restaurant-music-club`) carry no coordinates either — meaning "Fetch
candidates" was entirely disabled for those 6, and Google fetching (auto OR the
"Also fetch Google" button) was unreachable for all 18. Fixed:
`app/api/admin/venues/edit/route.ts` now also accepts `place_id`/`lat`/`lng` in the
patch; `VenueDetailSheet` (`VenuesView.tsx`) gained three inputs (place_id,
latitude, longitude) plus an inline note + link to Google's Place ID Finder when a
venue has neither set. `tsc --noEmit` and 540/540 tests clean; confirmed the dev
server still renders the public site with no behavior change (this only touches
the founder-only editor).

**Files touched (this addendum):** `app/api/admin/venues/edit/route.ts`
(`place_id`/`lat`/`lng` in the patch), `app/admin/venues/VenuesView.tsx` (editor
inputs + empty-state help text), `app/admin/review/cockpit.css` (`.empty-note a`
link style).

**2026-07-10, later still — two more cockpit UX gaps Jim raised, both fixed:**
1. **Candidate/approved photos were thumbnail-sized (120px/96px) with no visible
   source.** Enlarged: candidate cards now `minmax(260px, 1fr)` in a wider sheet
   (`.sheet--wide`, `min(900px, 94vw)`, scoped to the Venues detail sheet only —
   didn't touch the shared `.sheet` used by the Hero picker); approved cards
   160px. Both now show a `.cc-src` pill (top-left, spelled out — "Google" /
   "Wikimedia", not just a color, for accessibility) using existing tokens
   (`--pacific-dark` / `--sage-text`, no invented hex), plus an attribution caption
   line underneath each card.
2. **No un-archive path existed — an accidental "Archive venue" click had no
   recovery.** `loadVenuesData()`'s query filtered to `status='active'` only, so an
   archived venue vanished from the tab entirely. Added a collapsed-by-default
   "Show archived venues" section (`lib/venuesServer.ts`'s new
   `archivedVenues` list) with an Un-archive button per venue (same
   `/api/admin/venues/edit` route, `status: 'active'`) — no new route needed.

**Verification:** `tsc --noEmit` and 540/540 tests clean; dev server still renders
the public site unaffected (cockpit-only changes).

**Files touched (this addendum):** `lib/venuesServer.ts` (`archivedVenues` query +
type), `app/admin/venues/VenuesView.tsx` (larger photo cards, source pills,
attribution captions, archived-venues section + un-archive), `app/admin/review/
cockpit.css` (`.sheet--wide`, enlarged `.candidatecard`/`.approvedcard`, `.cc-src`).

**2026-07-10, later still — "Fetch via Google" made an always-available override,
not a conditional offer.** Jim asked for an explicit override button; the existing
"Also fetch Google photos" button only appeared when a prior fetch's response
flagged `googleAvailableButSkipped` (Wikimedia found ≥3, Google auto-skipped) — it
disappeared once Google had been fetched once, with no way to re-invoke it.
Replaced with an unconditional "Fetch via Google" button (disabled only when the
venue has no `place_id`), always sending `include_google: true`. Removed the
now-dead `googleOffers` per-venue state and the `googleAvailableButSkipped`
response field. Added an inline note: Google's Place Details `photos[]` is a fixed,
unpaginated list, so re-clicking won't surface anything new unless Google's own
listing changed — each click still spends real cap budget (1 free + up to 10
billable calls), so this is disclosed rather than silently allowed to be re-spent
for nothing.

**Verification:** `tsc --noEmit` and 540/540 tests clean; dev server unaffected.

**Files touched (this addendum):** `app/api/admin/venues/photos/fetch/route.ts`
(doc comments, dropped `googleAvailableButSkipped`), `app/admin/venues/
VenuesView.tsx` (unconditional button, dropped `googleOffers` state).

---

## 2026-07-09 — Card Imagery Phase 2 kickoff (reconciliation + DDL Moment 1, holding for Jim)

Source: `docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md` §5 (Phase 2). Continues
from the approved Phase 1 stop-and-show above (Phase 1 is fully done; still holding,
per that entry's own last line, until this phase's own gate clears).

**Reconciliation (§5's own "reconcile first" list):**
- `ingest/images.ts`, `ingest/run.ts`, `packages/shared/types.ts`: unchanged since
  Phase 1, still current.
- **Cockpit tab components — stale count found.** The spec's §1 "current state" (and
  this build's own canon note) describes four cockpit tabs (Queue / Coverage / Live
  catalog / Hero plan). Live `app/admin/CockpitTabs.tsx` already has **five** — Edition
  draft shipped since that description was written. §5.3's "add a fifth tab" is
  therefore stale wording; Venues will be the **sixth** tab. Noted for the record, not
  itself a build change.
- **Supabase schema — live-queried, read-only, via the service-role key** (no direct
  DB tool available; a short scratch script under the session's scratchpad, run then
  discarded, mirroring how Phase 1's live counts were pulled). Confirmed: no `venues`
  or `venue_photos` table exists yet, no `things.venue_id` column exists yet — the
  spec's DDL has zero name collisions. `gen_random_uuid()` (pgcrypto) and
  `set_updated_at()` are both already live and reusable as-is.

**`IMAGE_MONTHLY_CALL_CAP` verification (Jim's explicit ask this session) — found and
fixed a real gap, not just confirmed presence:**
- Code reads it correctly: `ingest/images.ts:39`,
  `Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 500)`.
- **Vercel: confirmed present** via `vercel env ls` (CLI already linked to this
  project) — Preview + Production, created ~5 minutes before this session started
  (value never printed, per the env-vars table's own rule). Currently a **no-op on
  Vercel's side**, though: nothing in the Vercel-deployed app reads this var today —
  only `ingest/images.ts` does, and that module only ever executes inside the GitHub
  Action. It becomes load-bearing the moment §5.3's cockpit "Fetch candidates" Google
  call ships as a Vercel API route later this phase.
- **GitHub: gap found and fixed.** `.github/workflows/ingest.yml`'s ingest step `env:`
  block never referenced `IMAGE_MONTHLY_CALL_CAP` at all — so even with Jim adding it
  on GitHub's side, the nightly worker process would never actually have seen it and
  would silently keep running on the code's hardcoded `500` default. (Harmless today
  only by coincidence: the default already equals 500, so no behavior changed, but the
  moment Jim ever changes the cap from the GitHub side without a code change, it would
  have silently not taken effect.) Fixed: added
  `IMAGE_MONTHLY_CALL_CAP: ${{ vars.IMAGE_MONTHLY_CALL_CAP }}` to the step's `env:`
  block. **Confirmed with Jim: he added it as a repo *variable*, not a secret** — so
  this uses `vars.*`, the one line in that block that isn't `secrets.*` (every other
  entry there is a real credential; a runaway-guard number isn't sensitive). No `gh`
  CLI/token available in this environment (same gap the Phase 0 entry already
  flagged) to have confirmed this independently — took Jim's word for it.

**Phase 2 DDL (§5.1) generated, verified against the live schema above, and checked in
as `supabase/migrations/20260709_card_imagery_phase2_venues.sql` — NOT yet run; handed
to Jim as a copy-paste block per the kickoff's own instruction, holding for his
confirmation before anything downstream is built.** One addition beyond the spec's
literal §5.1 text: a `trg_venues_updated` trigger (reusing the existing
`set_updated_at()` function `things`/`guides` already share) so `venues.updated_at`
actually advances on a cockpit edit (§5.3's venue editor: rename / radius / archive)
instead of freezing at insert time forever — the spec declared the column but named no
trigger for it. `venue_photos` intentionally gets no such trigger (matches spec — that
table has no `updated_at` column). Everything else in the migration is verbatim §5.1.

**Sizing data pulled live while verifying the schema (read-only; informs §5.2 seeding
and §5.5's cap math next phase — not acted on yet, no building done against it):**
22 Tier-1 address clusters with ≥3 events, 34 with ≥2 (of 53 distinct addresses) — the
spec's own guess was "≈30 to 60 venues"; naive exact-address-string clustering already
comes in under that low end, though §5.2's real lat/lng-radius + fuzzy-name pass (not
yet built) may surface more once it runs. Current `photo_source` split across all 606
published/needs_review rows: 532 placeholder · 57 pexels · 14 google · 3 wikimedia. 25
food/drink rows carry a `place_id`. `image_spend` for 2026-07: 62 `google_calls`, 0
`over_cap` so far.

**Status: holding at the DDL handoff, exactly per the kickoff's own instruction.**
Did not touch venue registry seeding, the cockpit Venues tab, pool rotation, per-feed
dedupe, or the nightly Google refresh step — every one of them depends on this
migration existing. Waiting for Jim to run
`supabase/migrations/20260709_card_imagery_phase2_venues.sql` in the Supabase SQL
Editor and confirm before continuing. Do not begin building anything past this point
without that confirmation.

**Files touched:** `.github/workflows/ingest.yml` (`IMAGE_MONTHLY_CALL_CAP` env wiring),
`supabase/migrations/20260709_card_imagery_phase2_venues.sql` (new, unrun).

---

## 2026-07-09 — Live catalog: photo picker (Jim's ask, outside the Card Imagery spec)

Source: Jim, direct request — explicitly **not** part of `SBDaymaker_CardImagery_BuildSpec.md`.
The Live catalog edit sheet (`/admin/catalog`) let a founder edit title/blurb/
neighborhood/tags but had no way to change a thing's photo at all — the only image
affordance anywhere in the cockpit was the Queue's pre-publish picker. Reconciled
first: `app/admin/catalog/CatalogView.tsx` (the sheet), `lib/catalogServer.ts` +
`lib/review.ts` (`CatalogRow` didn't carry `photo_options`/`photo_attribution` at
all), `app/admin/review/ImagePicker.tsx` (the existing cycle-through-alternates +
source-pill component, reused as-is), `app/admin/WeightNudge.tsx` +
`/api/admin/weight` (the "metadata-immediate, optimistic, revert-on-error" pattern
this follows, instead of the Queue's approve-gated pattern).

**Built:**
- `CatalogRow` gained `photo_options` + `photo_attribution`; `lib/catalogServer.ts`'s
  `SELECT` now carries both (previously only `photo_url`/`photo_source`).
- **`app/admin/catalog/CatalogImagePicker.tsx`** (new) — wraps the existing
  `ImagePicker` (unchanged, still shared with the Queue) with an attribution line and
  a "Use this photo" button. Cycling through options is a free, local index move (no
  network, same as the Queue); "Use this photo" is the one deliberate commit action,
  posting straight to the new apply route — **this is the "instant" in "select and it
  applies instantly": browsing is free, one click commits.** The button reads
  "Currently live" (disabled) when the shown option already matches the row's actual
  photo.
- **`POST /api/admin/catalog/photo`** (new) — the instant-apply route, modeled
  directly on `/api/admin/weight`: admin-gated, updates `photo_url`/`photo_source`/
  `photo_attribution` on the live row, writes one `audit_log` row (`action:
  "photo_set"`), calls `revalidatePublic()`. `source: "placeholder"` with no `url`
  explicitly clears back to the branded gradient — a real, discoverable "remove
  photo" affordance that didn't exist before. Also folds the applied pick into
  `photo_options` (dedup by url) so a photo found via "find more" is still
  recognized as the live pick if the founder reopens edit later.
- **`POST /api/admin/catalog/find-more-images`** (new) — the "Try fetching a photo"
  fallback `ImagePicker` already shows when a thing's `photo_options` is empty. The
  Queue's own version of this button (`/api/review/image-fetch`) is a dead Phase-13
  stub that always no-ops; rather than ship a second broken copy of that button in
  new work, wired this one to the **real** `findMoreOptions()` (ingest/images.ts),
  querying via `imageQuery({title, neighborhood, happening_category})` — title-
  specific, unlike `lib/edition/imageDiscovery.ts`'s `discoverMoreImages` (used by
  the edition drafter), which deliberately drops the title for category/neighborhood-
  only variety and would have returned generic, not venue-specific, results here.
  Free sources only (Pexels + Wikimedia), matching `findMoreOptions`'s own no-Google
  rule for repeated on-demand clicks. Read-only — nothing persists until "Use this
  photo" is clicked.

**Verification:** `tsc --noEmit` and all 524 vitest tests clean. **Could not click
through the authenticated cockpit UI itself** — no admin login session in this
environment (`/admin/catalog` correctly redirects unauthenticated requests to
`/cockpit/login`, confirmed via `curl`; not worked around). Verified by code
reading + the type/test surface only. **Ask Jim to test directly:** open
`/admin/catalog`, Edit any published thing, confirm the photo picker shows above
Title with a source pill, cycling arrows is instant/free, "Use this photo" updates
the row's thumbnail in the list behind the sheet immediately and flips to
"Currently live," and (for a thing with no `photo_options`) "Try fetching a photo"
returns real alternates.

**Deliberately not built:** a `photo_locked`/founder-pick marker column — this is
the same pre-existing gap the 2026-07-09 Phase 0 entry already flagged (no way to
tell a founder's manual pick from an auto-resolved one), and adding one is a DDL
change, out of scope for this ask. The `audit_log` row (`photo_set`) is at least a
trace, matching every other instant-apply route's own precedent.

**Files touched:** `lib/review.ts`, `lib/catalogServer.ts`,
`app/admin/catalog/CatalogImagePicker.tsx` (new), `app/admin/catalog/CatalogView.tsx`,
`app/api/admin/catalog/photo/route.ts` (new),
`app/api/admin/catalog/find-more-images/route.ts` (new), `app/admin/review/cockpit.css`.

---

## 2026-07-09 — Card Imagery Phase 1 (places + marquee inheritance)

Source: `docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md` §4 (Phase 1). Continues
directly from the approved Phase 0 triage below.

**Pricing gate (spec §4.5 mandate: re-verify before any Google call fires) — cleared,
real cost is BETTER than the spec's assumption, not worse.** Checked against Google's
live pricing pages (`developers.google.com/maps/billing-and-pricing/pricing`, `.../faq`,
`.../place-details`), 2026-07-09:

- The resolver's two Google calls are billed on **different SKUs**, not one blended
  "~$20/1,000 ×2 calls" rate as the spec assumed:
  1. **Place Details call (`X-Goog-FieldMask: photos`)** — the `photos` field is grouped
     under **"Place Details Essentials IDs Only"** (SKU `5C36-E272-E88F`), which Google
     prices at **$0, unlimited** (not Enterprise-tier at all).
  2. **Place Photo media call** (the actual servable-image fetch) — billed under
     **"Places API Place Details Photos"** (SKU `DCD1-FE97-8C71`, Enterprise tier) at
     **$7.00 per 1,000 calls** at the base (0–100,000/mo) bracket, declining at higher
     volume. This is the spec's cited "$20/1,000," corrected: real Enterprise Place
     Details pricing starts at $20/1,000, but **Photos is its own, cheaper SKU** at $7/1,000.
- **Free monthly allowance:** Google discontinued the old blanket $200/mo credit for
  every customer on **2025-03-01**, replacing it with a **per-SKU free monthly
  threshold**: Essentials 10,000/mo, Pro 5,000/mo, **Enterprise 1,000/mo**. The Photos
  SKU is Enterprise-tier, so it gets **1,000 free calls/month** — this matches the
  spec's own "~1,000 free events/mo Enterprise" assumption exactly; that part of the
  spec was already current.
- **Net finding:** real cost per successfully-resolved Google photo is **≈$7/1,000**
  (only the media call is billable; the field-mask call is free/unlimited), against
  the spec's worst-case assumption of **≈$40/1,000** (two calls × $20/1,000) — roughly
  **5–6× cheaper** than assumed, with the same free-tier ceiling. **Not materially
  worse — cleared to proceed without flagging Jim**, per the spec's own instruction
  that this gate only blocks on a worse-than-assumed finding.
- **Left unchanged, noted for the record:** `resolveImages()`'s `onCall()` counter still
  increments the shared cap once per call (so 2 per resolved Google photo), even though
  only the second call is actually billable — i.e. the 500/mo cap is a stricter
  runaway-guard than the true dollar cost requires (effectively rationing ~250
  real photo-fetches/mo of cap headroom, not 500). This matches the spec's own cost
  posture ("every Google request path must call the existing onCall-style counter" —
  a call-count guard, not a dollar-metered one) — not changed, just flagged so a future
  session doesn't mistake the cap for the true spend ceiling.
- Sources: [Google Maps Platform core services pricing list](https://developers.google.com/maps/billing-and-pricing/pricing),
  [Pricing and Billing FAQ](https://developers.google.com/maps/billing-and-pricing/faq),
  [Place Details (New)](https://developers.google.com/maps/documentation/places/web-service/place-details).
- `GOOGLE_PLACES_KEY` presence verified in `.github/workflows/ingest.yml` (wired to
  `secrets.GOOGLE_PLACES_KEY`, unchanged from Phase 0); not present in local
  `.env.local`, so local dev runs never fire a real Google call (safe default). Value
  never printed, per the env-vars table's own rule.

**Reconciliation (spec §4's own "reconcile first" list) — no path deviations found.**
`ingest/images.ts`, the cockpit picker (`app/admin/review/ImagePicker.tsx` +
`ReviewCard.tsx` + `lib/review.ts`), the detail page (`app/(app)/thing/[id]/page.tsx` +
`lib/things.ts`), and `packages/shared/types.ts` all matched the spec's description.
`Candidate` already carries `lat`/`lng`/`place_id`/`neighborhood`, so no shared-type
changes were needed. `things.photo_attribution` already exists in the base schema
(`Core Project Files/sbdaymaker_schema.sql`) — **zero DDL this phase**, as the spec's
own header predicted.

**Built (§4.1–§4.5):**
1. **Wikimedia geosearch upgrade** (`ingest/images.ts`) — `wikimediaGeosearch(lat,lng)`
   (generator=geosearch, ggsradius=200/ggslimit=10, `prop=imageinfo|coordinates` —
   verified live against the Commons API 2026-07-09 that the geosearch generator does
   **not** carry `dist` through the way the list-module form does, so distance is
   computed via a new `haversineMeters()` from each result's returned `coordinates`)
   and `wikimediaTitleSearch(query)` (the old behavior, narrowed to a fallback). The
   orchestrator `wikimedia(c, query)` picks geosearch when `lat`/`lng` exist (any
   tier), else title-search **only for places** — a Tier-1 event with no coordinates
   gets no Wikimedia photo at all, per §4.1's explicit rule, rather than an
   unverified-location title match.
2. **Quality gate** (`passesWikimediaGate`, `scoreWikimediaCandidate`,
   `pickBestWikimedia`) — rejects <800px width, aspect outside 1:1–2.2:1, a
   blocklisted filename, or a non-jpeg/png/webp MIME; scores survivors by keyword
   overlap (+2/token) + license (PD/CC0 +3, CC BY +2, CC BY-SA +1) with ascending
   distance as the tiebreak; a below-threshold (<2) survivor is a miss, not a forced
   pick. This is now the **sole** quality check for Wikimedia results — the outer
   resolver no longer re-applies the generic 960px `meetsQualityBar()` to a
   `wikimedia()` pick (its own 800px + aspect/blocklist/MIME gate supersedes it for
   this source only; that generic bar still applies to Pexels/Google as before).
   Unit tests cover all four spec-named fixtures (map reject, logo reject,
   portrait-orientation reject, PD outranking CC BY-SA) plus MIME/ultra-wide/
   distance-tiebreak/below-threshold cases.
3. **Attribution rendering** (`lib/things.ts`, `app/(app)/thing/[id]/page.tsx`,
   `app/components.css`) — `photo_attribution` added to the detail-only select
   (`SELECT_DETAIL`, alongside `local_note`; the feed selects are untouched, so the
   card rail never carries it). Renders as a small `--text-muted` (`--ink-2`, 9:1
   AA-safe) line under the photo block, only when `photo_url` exists and
   `photo_source !== 'owned'`. **Scope note:** the spec's "with source link where
   available" is not built — `photo_attribution` is a single formatted string column
   (no per-photo source-URL column exists, and adding one is a DDL change this
   zero-DDL phase doesn't take); rendered as plain text, matching the literal format
   spec gives (`"{artist} · {license} · Wikimedia Commons"` / `"{author} (Google)"`).
4. **Marquee registry** (`ingest/marqueeVenues.ts`, new) — the 12 named landmarks,
   coordinates geocoded via OpenStreetMap Nominatim 2026-07-09 (same method as the
   2026-07-08 State Street entry), `pinnedPhoto` empty on every entry. `haversineMeters()`
   + `matchMarqueeVenue()` (name-token match, then haversine ≤ `radiusM`) are pure and
   unit-tested. Wired into `resolveImages()` as priority 2 ("venue pool"), checked
   between the cache-hit path and direct-Google-for-food — currently a no-op on every
   real candidate (no pins yet) but structurally live for the moment Jim pins one.
5. **Direct Google for food/drink** (`ingest/images.ts`) — `isDirectGoogleFoodCandidate()`
   (food_drink_spot / weekly_special / type `happyhour`) with a `place_id` routes to
   `googlePhoto()` **before** Wikimedia/Pexels. A hit there short-circuits the rest of
   the gathering for that candidate (no Wikimedia/Pexels call, no double-spend on the
   same `place_id` if the old free-tier-exhausted fallback would otherwise re-try it).
   Scoped backfill `backfillFoodImages()` (`IMAGE_BACKFILL_FOOD=1`, new workflow input)
   re-resolves published food/drink rows with a `place_id`, forced.

**Judgment calls (not spelled out by the spec, decided and recorded):**
- **Civic guard placement:** marquee matching sits *inside* `isCivicImage()`'s gate
  (a civic-meeting title at a marquee venue still renders the placeholder, not the
  landmark photo). The spec doesn't address the interaction; with every pin empty
  this phase there's zero live behavior difference either way, and the existing
  conservative default (no photo) is a safe one — not revisited unless Jim wants a
  civic meeting at, say, the Courthouse to show the landmark photo.
- **Marquee pin skips the relevance vision-check and the generic quality bar:** a
  pin is a founder-approved choice (reviewed before pinning), not an auto-match — the
  vision guard exists to catch a wrong *auto*-pick, so it has nothing to verify here.
  New `skipRelevance` flag threads this through `resolveImages()`'s pending-candidate
  bookkeeping.
- **Food-venue Google hit skips further gathering entirely** (not "gather everything,
  rank after," the Phase 0 header's general framing) — a deliberate, food-specific
  exception: gathering Wikimedia/Pexels *anyway* after a successful direct-Google hit
  would let the outer `rankOptions()`'s generic `wikimedia > google` order silently
  override the food-first routing this section exists to add. Skipping avoids that
  conflict outright and saves free-tier quota; the founder can still widen alternates
  later via the existing "find more options" picker action if they want to override.
- **Wikimedia blocklist normalization bug caught before it shipped:** Commons
  filenames use underscores as word separators (confirmed live via the Commons API,
  e.g. `SB_EastBeachPark_20140909.jpg`); `\b` treats `_` as a word character, so
  `\bmap\b` would silently miss `Santa_Barbara_Map_1875.jpg`. Fixed by normalizing
  `_`/`-` to spaces before the blocklist test — caught by writing the map-file test
  fixture with an underscored name instead of a spaced one.
- **`findMoreOptions()` (cockpit "find more options," edition drafter's multi-angle
  widen) stays title-search-only** — neither call site has a candidate's lat/lng
  (`QueryableThing` carries only `neighborhood`/`happening_category`), so geosearch
  mode isn't reachable there; it now routes through the same gate/scorer as the main
  resolver's fallback path instead of the old ungated first-match.

**Pre-existing gap found and fixed, not introduced by this phase: `photo_attribution`
was never actually written to `things`.** The column exists in the base schema and
`image_cache.attribution` was already populated, but neither `land.ts`'s `toThingRow()`
(initial land) nor any of the three existing backfill functions' `.update()` calls
included `photo_attribution` — and `Candidate` itself had no `photo_attribution` field
to carry it. Without this, §4.3's read+render side would have been dead code: the
column would stay `null` forever regardless of how many backfills ran. Fixed by adding
`photo_attribution?: string` to `Candidate` (`packages/shared/types.ts`), setting it in
`resolveImages()` on **both** the fresh-resolve path and the cache-hit path (the cache
row already carries `attribution`; the cache-hit branch just wasn't surfacing it onto
the returned Candidate either), and adding the column to `toThingRow()` plus all four
backfill `.update()` calls (the three existing ones + this phase's new
`backfillFoodImages()`). Found by tracing the write path before attempting the
stop-and-show screenshot — an already-published thing's attribution would otherwise
have rendered blank even after a real Wikimedia/Google resolution.

**Deliberately deferred, flagged rather than silently dropped: the §4.4 cockpit
pinning UI** (surfacing top-5 gated geosearch results labeled "landmark" in the Live
catalog picker, and the paste-ready `marqueeVenues.ts` snippet-on-pin flow mirroring
`RegistrySnippetPanel`). The kickoff's own build list named "the marquee registry file
with empty pins," not the cockpit surfacing, and the stop-and-show doesn't ask for a
cockpit screenshot — building it now would have meant a new API route, a new picker
mode, and a new snippet-builder component, none of which change anything visible until
Jim actually has a pin to make. The registry + resolver-priority plumbing above is
fully real and load-bearing today; only the founder-facing "how do I fill in a pin"
workflow is pending. Flagging for Jim's call at the stop-and-show rather than deciding
unilaterally to build or skip it.

**Verification:** 524/524 vitest tests passing (58 new: 50 in `ingest/images.test.ts`
covering the gate/scorer/food-candidate additions, 8 in new `ingest/marqueeVenues.test.ts`).
`tsc --noEmit` clean on every touched file (two pre-existing test fixtures —
`lib/explore.test.ts`, `lib/savedView.test.ts` — needed a `photo_attribution: null`
default added to their `Thing` fixture builders after the interface gained the field).
Remaining `tsc` noise is entirely pre-existing stray `" 2"`-suffixed duplicate files
from the known iCloud-sync issue (`.next/dev/types/*.d 2.ts`, `lib/explore.test 2.ts`)
— untracked, predate this session, not touched.

**Files touched:** `ingest/images.ts`, `ingest/images.test.ts`, `ingest/marqueeVenues.ts`
(new), `ingest/marqueeVenues.test.ts` (new), `ingest/run.ts` (`backfillFoodImages()` +
`IMAGE_BACKFILL_FOOD` + `photo_attribution` in all four backfill updates),
`.github/workflows/ingest.yml` (`image_backfill_food` input), `ingest/land.ts`
(`photo_attribution` in `toThingRow()`), `packages/shared/types.ts`
(`Candidate.photo_attribution`), `lib/things.ts` (`photo_attribution`),
`app/(app)/thing/[id]/page.tsx` (attribution render), `app/components.css`
(`.sbd-detail__attribution`), `lib/explore.test.ts` + `lib/savedView.test.ts`
(fixture fix, see above).

**Stop-and-show, screens captured 2026-07-09 (dev server against live Supabase data,
Playwright, zero console errors on every page):**
- Explore at 390px and 1280px: hero pick renders, `Today` horizon shows two Tier-3
  evergreen fallback cards with the occasion-gradient (`family_day` — LOTG · Shoreline
  Park, LOTG · Cleveland School), no Pexels visible, no blank cards. 1280px is the same
  single-column mobile-first layout at a wider centered frame (no separate desktop
  layout exists — expected, not a bug).
- **Food-venue detail page (Topa Topa Brewing Co.) — read-only DB check first, before
  screenshotting: all 17 published food/drink things (14 with a `place_id`) are
  currently `photo_source='pexels'`; none have ever been Wikimedia/Google-resolved.**
  So today's real render correctly shows **no attribution line** (Topa Topa's own
  Pexels beer/pizza photo, no credit — matches the code: attribution is null until a
  row is actually re-resolved). Showing a populated credit line for a food venue
  needs the new §4.5 routing to actually run once — which means firing this app's
  **first-ever live Google Places calls** and rewriting already-published, publicly
  visible photos without a founder review step (the scoped backfill targets
  `published` rows directly, same pattern as the Phase 0 published-image backfill).
  Small and cheap either way (~14 rows, well under the cap, ≈$0.10 total at the
  verified $7/1,000 rate) — held for Jim's explicit go rather than assumed, since it's
  a threshold-crossing action (first paid spend + live-photo mutation) distinct from
  "render what already exists."
- Incidentally surfaced by the same DB check: the only 3 published things currently on
  `photo_source='wikimedia'` all predate this build and show exactly the failure mode
  §4.1/§4.2 exist to fix — Santa Barbara Museum of Art's cached credit reads "Whitney
  Museum of American Art" (a wrong, unrelated NYC museum — the old title-search
  matched on a generic keyword, not geography), and Shoreline Park's reads the bare
  "Wikimedia Commons" fallback (artist field was empty). Left as-is rather than
  papered over with a copy-paste fix — these are exactly the rows a forced re-resolve
  through the new geosearch+gate path would correct for real, and a stale/wrong
  attribution string is a worse demo than none.

**Status:** code complete, 524/524 tests passing, `tsc --noEmit` clean (see above).
Stop-and-show screens captured; asking Jim to confirm before firing the food-set
backfill's first live Google spend, per the note above. Do not begin Phase 2.

**2026-07-09, same day — Jim provided `GOOGLE_PLACES_KEY` in local `.env.local` and
authorized running the food backfill directly from this session.** Ran
`IMAGE_BACKFILL_FOOD=1 npx tsx ingest/run.ts` twice (see below for why twice).

**First run: all 14 rows resolved, but 0 via Google (`free 14 · google 0`) — result
was correct-looking but silently wrong.** `image_spend.google_calls` incremented by 20
(confirming real network calls fired), yet every row fell through to its existing
Pexels photo. `googlePhoto()` had no failure logging on a non-OK HTTP response — it
silently returns `null` on any error, indistinguishable in the stats from "this place
genuinely has no Google photos." Added `console.log` on both the Details and Media
non-OK branches (`ingest/images.ts`) before investigating further, rather than
guessing blind or adding throwaway diagnostic scripts that touch the live key
directly (an ad hoc script probing the key was correctly blocked by the session's own
auto-mode safety classifier as credential-touching; the right fix was better logging
in the actual code path, not a workaround).

**Second run, with logging in place, found the real cause: every one of the 14
places got `403 PERMISSION_DENIED` on the Details call** — "Requests to this API
places.googleapis.com method google.maps.places.v1.Places.GetPlace are blocked,"
reason `API_KEY_S…` (truncated in the log; widened the slice to 600 chars for next
time, not re-run again to avoid a third round of calls for a diagnosis that's already
conclusive). **This is a Google Cloud Console configuration gap, not a code bug** —
uniform 403s across 14 distinct, well-formed, real place_ids (`ChIJ…` format,
verified) rules out a per-place data problem. Needs one of, on the project tied to
this key: (1) enable **"Places API (New)"** in the Cloud Console (the *legacy* Places
API being enabled instead is a common miss — New and legacy are separate products),
(2) confirm **billing is enabled** on that GCP project (Places API (New) requires it
even for free-tier usage), (3) check the **key's own API restrictions** actually
include Places API (New), not just legacy Places/Maps JS.
- **Reassuring finding, not just a failure:** the block happened at the **free**
  Details/`GetPlace` call (Essentials IDs Only SKU, $0) — neither run ever reached the
  billable Photo-media step. Real spend from both attempts: **$0.** `image_spend`'s
  `google_calls` counter did increment (call-count guard, not a dollar meter, exactly
  as designed), so it will need zeroing or will just self-correct next month; not
  reset manually since it's an accurate count of calls actually made.
- **Still nothing to show for the food-venue credit line** — the 14 rows are exactly
  where they were before either run (Pexels, no attribution). Blocked on the Cloud
  Console fix above; will re-run the same `image_backfill_food` path (locally or via
  Actions, Jim's choice) once that's resolved.

**Files touched (this addendum):** `ingest/images.ts` (failure logging in
`googlePhoto()`, no behavior change).

**2026-07-09, same day — Jim fixed the Cloud Console config; third run succeeded
cleanly.** `IMAGE_BACKFILL_FOOD=1 npx tsx ingest/run.ts` re-run once more:
**`updated 14/14 — free 0 · google 14 · placeholder 0 · over-cap 0`** — every food/
drink row with a `place_id` now resolves via direct Google, each with a real,
venue-specific attribution (mostly the business's own name as author — e.g. "Topa
Topa Brewing Co. (Google)", "Third Window Brewing Carpinteria" → "Joseph Dandona Jr.
(Google)" — a named individual, so presumably a Google Local Guide contributor rather
than the business itself). **Verified live:** Topa Topa Brewing Co.'s detail page now
shows the venue's actual taproom (bar, tap wall, palm tree out front — not a generic
stock photo) with `Topa Topa Brewing Co. (Google)` rendered as the small muted credit
line under the photo, zero console errors. `image_spend.google_calls` for 2026-07 is
now 62 cumulative (this run's 28 = 14 Details + 14 Media, on top of the two earlier
diagnostic runs' 20 + 14) — real dollar cost from the only-ever-billable step (14
Media calls) is **≈$0.10 total**, trivially inside the cap and the verified pricing.

**Card Imagery Phase 1 is now fully done, not just code-complete:** all four
deliverables (marquee registry, geosearch+gate, attribution write+render, direct
Google food routing) are built, tested, AND demonstrated against real production data
with a real result Jim can see live. Still holding at the Phase 1 stop-and-show per
the kickoff instruction — do not begin Phase 2 without explicit go-ahead.

---

## 2026-07-09 — Card Imagery Phase 0 (triage: relevance-first ranking, events default to no photo)

Source: `docs/card-imagery/SBDaymaker_CardImagery_BuildSpec.md` §3 (Phase 0). No DDL,
fully reversible. First step per the spec's own ground rule 1: reconcile §1 "current
state" against live code — several deviations found before writing anything.

**Path deviations (spec text vs. live repo):**
- `ingest/pipeline.ts` (named in both the spec and the kickoff prompt as a file to
  reconcile) **does not exist.** There is no separate ingest pipeline file — the
  nightly worker's orchestration lives entirely in `ingest/run.ts`, which is the
  actual call site for `resolveImages()`. `lib/pipeline.ts` is unrelated: the retired
  duplicate cockpit-era worker already flagged dead in CLAUDE.md §10 (Wave 4
  cleanup), untouched by this change.
- The Build Deltas ledger itself lives at `Core Project Files/14_SBDaymaker_Build_Deltas.md`,
  not `docs/14_SBDaymaker_Build_Deltas.md` as both the spec and the kickoff prompt
  say. This entry is recorded at the real path.

**Current-state diagnosis is more nuanced than spec §1 describes.** The live resolver
already carries three guards the spec's "current state" section doesn't mention:
`isCivicImage()` (civic-meeting titles skip network sources entirely), `meetsQualityBar()`
(a 960×540 HD floor rejecting undersized results before they can be picked), and
`checkImageRelevance()` (a batched Claude Haiku **vision** call, nightly/batch-only,
that screens the resolver's auto-pick and falls back to placeholder on an obvious
mismatch). None of these existed when the spec's cited 591/592-Pexels live-site audit
was run; the exact current split is unverified from this session (no direct prod DB
query tool available here) but is almost certainly less lopsided than the spec assumes.
Diagnosis and fix direction are unaffected — flagging for the record, not disputing
the plan.

**Judgment calls made while implementing §3.1:**
1. **Change 3 (de-dup guard):** already satisfied by the existing `pickUnused()` +
   catalog-wide usage-count mechanism (W2.3), which is strictly stronger than the
   plain in-run `Set` the spec describes (it spreads repeats evenly across a shared
   pool using historical `image_cache` counts, not just this run's picks). No new
   guard added — a second, weaker mechanism would just be confusing.
2. **Change 2's "never clobber founder picks" exception:** confirmed via code search
   that **no mechanism exists** to distinguish a founder's cockpit pick from an
   auto-resolved pick on a `things` row — `photo_source`/`photo_url` are written
   identically by both `/api/review/approve` and `resolveImages()`; no
   `photo_locked`/`photo_pinned` column, no dedicated `audit_log` action. Not
   addable in Phase 0 (no DDL). Resolved structurally instead: the two call sites
   this phase touches (`ingest/run.ts`'s nightly land path, which only ever handles
   brand-new candidates, and `backfillImages()`, which is hard-filtered to
   `status='needs_review'`) never touch an already-`published` (i.e.
   founder-reviewed) row, so no founder pick is at risk from this change.
   **Pre-existing, out-of-scope gap noted, not fixed:** `backfillRepeatImages()`
   (`REPEAT_BACKFILL=1`, a separate on-demand tool) forces a re-resolve of
   `published` rows whose photo is shared by 3+ things with zero awareness of
   founder authorship — this predates Phase 0 and isn't in its change list, so it's
   left alone per "known open items, don't silently fix" (CLAUDE.md §10). It did
   pick up one incidental one-line fix shared with `backfillImages()` (below).
3. **`image_cache` now intentionally diverges from the `things` row for Tier-1
   events.** The cache still stores the *real* per-place resolution (whatever was
   actually found), so a future non-event candidate at the same `place_key` isn't
   starved by an event's forced placeholder. Only the `things`-row write (what's
   actually displayed) applies the tier override. This wasn't spelled out in the
   spec; without it, a second same-day event at a venue already cached by a first
   event would incorrectly inherit that place's real photo bypassing the new rule
   — fixed in both the cache-hit fast path and the fresh-resolve path.
4. **Incidental bug fix required by change 2:** both `backfillImages()` and
   `backfillRepeatImages()` had a `continue`-and-skip-the-write guard keyed on
   `photo_source === 'placeholder'`, which would have silently dropped the
   `photo_options` write for Tier-1 events (the exact data the cockpit picker needs
   per the spec's explicit "photo_options still gathered and stored" requirement).
   Narrowed the skip to only fire when there are truly no real alternates.
5. **`.github/workflows/ingest.yml` had no `image_force` input** — only
   `image_backfill`. `IMAGE_FORCE=1` (needed for the spec's "forced backfill") was
   therefore not dispatchable at all via the existing GitHub Actions path. Added an
   `image_force` boolean input, wired to `IMAGE_FORCE`, following the existing
   input pattern.
6. **Coverage report (change 6)** implemented as a console report appended to the
   end of `backfillImages()`'s existing run (`emitCoverageReport()` in
   `ingest/run.ts`), rather than a new dedicated workflow input — it reads the
   live catalog independent of whatever `backfillImages()` touched, so it's most
   useful printed right after a Phase 0 backfill completes. Tier-1 "clusters" use
   normalized-address string grouping (not true lat/lng-radius clustering, which is
   Phase 2 §5.2's dedicated seeding script) — sufficient to eyeball real
   concentration ahead of that phase, not a production clustering algorithm.
7. **No `gh` CLI or GitHub token available in this environment** to dispatch the
   Actions workflow programmatically (consistent with the earlier note that
   `GITHUB_DISPATCH_TOKEN` was never provisioned — see the Cockpit v2 C2b
   deferral). Per the kickoff instruction to never ask Jim to run terminal
   commands, he'll be asked to click "Run workflow" in the Actions tab (a UI
   action) with `image_backfill` + `image_force` checked, rather than being
   handed a CLI command.

8. **The forced backfill only reaches 47/606 things, and the public Explore feed
   won't visibly change yet.** Ran 2026-07-09 via the Actions UI
   (`IMAGE_BACKFILL=1 IMAGE_FORCE=1`, branch `fix/edition-bench-size-12`):
   47 `needs_review` rows re-resolved (free 25 · google 0 · placeholder 22), and
   the coverage report confirms the catalog-wide split is still 572 Pexels / 5
   Wikimedia / 0 Google / 29 placeholder out of 606. That's because
   `backfillImages()` (pre-existing, unchanged in Phase 0) is hard-scoped to
   `status='needs_review'` — and Explore's RLS policy (`sbdaymaker_schema.sql`
   `public_read_things`) only ever serves `status='published'` rows. The other
   ~559 things are published and structurally untouched by this run. This is the
   flip side of judgment call 2 above (no way to tell a founder pick from an
   auto-pick on a published row) — expanding the backfill to published rows would
   reopen exactly that clobbering risk, so it wasn't done unilaterally. Flagged to
   Jim at the stop-and-show rather than assumed either way; the new resolver logic
   is fully live for all *new* nightly landings regardless, so the published feed's
   mix will improve as content cycles even with no further action.

**Files touched:** `ingest/images.ts` (rank order flip, `eventDefaultsToNoPhoto()`,
cap default 1400→500 + comment, Tier-1 skip in both the cache-hit and fresh-resolve
paths, Google call skipped for Tier-1, relevance-check skipped for Tier-1),
`ingest/run.ts` (`emitCoverageReport()`, `photo_options` skip-guard fix in both
backfill functions), `.github/workflows/ingest.yml` (`image_force` input),
`ingest/images.test.ts` (updated `rankOptions` expectations, new
`eventDefaultsToNoPhoto` tests). `components/ui/Card.tsx` needed no change — its
existing occasion-gradient no-photo fallback already renders whatever this phase
now sends it.

**Status:** code complete, 498/498 tests passing, `tsc --noEmit` clean on all touched
files. Forced backfill run 2026-07-09 (see finding 8 above). Stop-and-show pending
Jim's review of the coverage report + the scope question in finding 8.

**2026-07-09, same day — Jim explicitly authorized the broader published-rows pass**
flagged in finding 8, accepting the founder-pick-clobbering risk rather than have it
worked around. Added `backfillPublishedImages()` (`IMAGE_BACKFILL_PUBLISHED=1`,
new workflow_dispatch input) rather than widening the existing `IMAGE_BACKFILL`
flag, so `needs_review`-only behavior stays the documented default for anyone
using that flag later.

Split by tier instead of one blanket forced pass, purely for cost/safety, not to
narrow what was authorized — the outcome (every published row re-evaluated under
the new logic) is the same either way:
- **Tier-1 events (~526 rows): resolved without `force`.** Events cluster at a
  small set of venues (the coverage report's 34 addresses with 2+ events), so
  their `place_key` is almost always already cached — this hits the cache-hit
  fast path + the tier-aware display override already built for Phase 0, i.e.
  effectively zero new network calls, not a partial application of the pass.
- **Tier-2/3 places (~80 rows): resolved with `force`,** so they actually get
  re-ranked relevance-first instead of reusing an old cached Pexels pick. This is
  the only branch that spends real network/API calls. Sized (~80 rows) to stay
  well clear of Pexels' ~200/hr free-tier rate limit and comfortably inside
  GitHub Actions' 20-minute job timeout. A handful of these (`food_drink_spot`
  with a `place_id` and no free hit) can reach the Google fallback for the first
  time — small, bounded real spend (well under the 500/mo cap), not zero, flagged
  so it isn't a surprise on the next `image_spend` check.
- The two branches run **sequentially, not in parallel** — both read-modify-write
  the shared `image_spend` counter; concurrent calls would race that update and
  could silently under-count Google spend.
- No founder-pick detection was added to this pass (e.g. an `audit_log` check
  mirroring `backfillVoice()`'s blurb-edit guard). Jim's authorization already
  resolved that exact question explicitly; unilaterally excluding some rows
  anyway would be quietly narrowing what he asked for, not protecting him from it.

**Same day, first run's actual result exposed a wrong assumption above — fixed
before a second run.** The "Tier-1 events are basically already cached" premise
was wrong: `cacheKey()` is title-based, and most of the ~505 Tier-1 titles are
unique even at a shared venue (194 events at the Library aren't 194 copies of one
title), so the great majority were fresh cache misses, not hits. Gathering
Pexels/Wikimedia for all 505 of them (still useful for `photo_options`, but their
*display* was always going to be forced to placeholder regardless of what was
found) exhausted Pexels' ~200/hr free-tier quota before the 54 Tier-2/3 places got
a turn. Worse, the resolver's existing "don't spend Google while Pexels is
rate-limited" guard (correct in isolation — a 429 isn't a genuine free-tier miss)
then also blocked the Google fallback for the rest of the run. Net effect: 52/54
Tier-2/3 places landed on `placeholder` — a real regression for rows that likely
had a decent, if generic, Pexels photo before this ran. (The 505 Tier-1 rows
themselves were unaffected by the rate limit — their outcome doesn't depend on
what's found — so no harm there.)

Fixed by reordering and simplifying, not by adding a retry/backoff: Tier-2/3
(forced) now runs **first**, so the bounded, valuable work gets first claim on the
shared quota. Tier-1 is no longer a `resolveImages()` call at all — since its
outcome is unconditional (`eventDefaultsToNoPhoto` forces placeholder regardless
of what a search would find), it's now a direct `things` UPDATE with zero network
calls, only touching rows not already on `placeholder`. This makes the whole
function idempotent and safe to re-run any time — re-running after this fix will
correctly resolve the 52 stuck Tier-2/3 rows without re-touching the 505 Tier-1
rows (already correct from the first run) or competing with them for quota.
Tier-1's `photo_options` (cockpit alternates) are no longer refreshed by this
specific pass as a result — an accepted trade for protecting the shared budget;
use the cockpit picker's "find more options" per-event if one is needed sooner
than the normal pipeline would supply it.

**Same day, second run: the fix above worked as designed (Tier-1 order/skip was
correct — 505 events cost zero network calls) but Tier-2/3 still hit a fresh 429
on only 54 candidates**, leaving 22 of 54 places on `placeholder` (down from 52,
real progress, but not the clean pass expected). Pexels' actual quota-reset timing
apparently didn't match the ~1hr assumption in the existing code comment — an
external account-level limit outside this codebase's control, not a logic bug.
Rather than keep asking Jim to guess how long to wait, made re-runs
self-converging: the Tier-2/3 selection now excludes rows already on
`wikimedia`/`google`/`owned`, so each re-run only spends quota on rows still stuck
at `pexels`/`placeholder` instead of re-confirming ones a prior run already fixed.
Cheaper every time, and reaches zero-remaining after enough re-runs regardless of
the true reset window. `resolveImages()`/`images.ts` untouched — this is entirely
row-selection logic in `backfillPublishedImages()`.

---

## 2026-07-08 — Living Postcard Phase 5 (State Street: catalog completed, guide published)

Follow-up to the 2026-07-07 entry below. Jim asked to close the 6 catalog MISSes and
take the guide live.

- **`seed_state_street_things.mjs`** (new) — added the 6 missing venues to `things`
  as published Tier-3 evergreens (`neighborhood`/`nearby_zone` = `downtown`), mirroring
  the existing Book Den / Public Market / Courthouse rows: Caje, The Arlington Theatre,
  La Arcada Courtyard, El Presidio de Santa Barbara, Palihouse, Paloma. Facts enriched,
  not invented: addresses from spec §7, coordinates geocoded via OpenStreetMap
  Nominatim and cross-checked by name where indexed (Cajé Coffee Roasters, Arlington
  Theatre, La Arcada Building, El Presidio de Santa Barbara State Historic Park all
  matched directly by name; La Arcada's exact 1114 State St storefront and Palihouse's
  915 Garden St resolved by address only). All 6 pass the Tier-3 publish gate.
- **`relink_state_street_stops.mjs`** (new) — re-pointed the 6 now-resolved
  `guide_stops` from label-only to `thing_id`-backed, clearing the authored
  `sub`/`maps_query` fallback so the sub-line and directions link auto-derive per
  spec §3/§4. All 9 stops are now thing-backed.
- **`resolve_state_street_images.mts`** (new) — one-off free-tier image backfill
  (reuses `ingest/images.ts`'s real `resolveImages()` waterfall) scoped to the 6 new
  thing ids directly, since `ingest/run.ts`'s `IMAGE_BACKFILL` mode only scans
  `status='needs_review'` rows and these are already `published`. 4/6 resolved a real
  Pexels photo (Caje, Palihouse, El Presidio, Paloma); 2 (Arlington Theatre, La Arcada
  Courtyard) were flagged irrelevant by the relevance guard and stayed on the branded
  placeholder rather than show a misleading stock photo. $0 cost (free tier only, 0
  Google calls; these rows carry no `place_id` so the paid step never engages).
- **`publish_state_street.mjs`** (new) — set `now_note` (the spec's own mockup copy,
  used verbatim per Jim's go-ahead) + `now_note_on='2026-07-08'`, then flipped
  `status` to `published`. Confirmed live: appears on the Discover SB hub next to The
  Funk Zone, "Right now" block renders, no console errors at 390px.
- **Declined for this launch (Jim's call, spec §8):** the planted ✵ wrong-time detail
  on the stop-5 Courthouse note. Shipping without it; the `b9` wink ("Nine stops. One
  of them keeps its own time.") still reads as an intriguing tease on its own, and the
  detail can be added later without touching anything else.
- **Still open, non-blocking:** Palihouse's exact public walk-in cocktail hours
  (`local_note` says "call ahead to confirm" rather than asserting a time); the
  optional §6 Funk Zone chapter-card consistency pass.

---

## 2026-07-07 — Living Postcard Phase 5 (State Street guide seeded, draft, holding for Jim)

Source: `docs/discover-sb-statestreet/Guide2_StateStreet_ClaudeCode_Build_Spec_v1.md`
(companion: `State_Street_Guide_Mockup_v8.html`). Guide 2 of 8 in the scale-out. DML
only, no DDL (Phase 1 columns already cover this shape). Seeded **draft**; holds for
Jim's ✵ edit, `now_note`, and publish approval per spec §8 (none of the three are
Claude Code's to finalize).

- **Seeded:** `seed_state_street_guide.mjs` — guide row (ID
  `483ec84a-c031-56e0-b9fd-5a2a98f90182`, `stamp_code='DT'`, `zone='downtown'`,
  `refreshed_on='2026-07-01'`, `status='draft'`, `now_note=null`) + 9 `guide_stops`.
- **§4 title resolution against `things` (trigram-assisted `ilike`, broadened past the
  spec's expected-match list to confirm each MISS) — 3 resolved, 6 MISS, wider than the
  spec anticipated:**

  | Label | Result |
  |---|---|
  | Caje | MISS → label-only |
  | The Arlington Theatre | MISS → label-only (only catalog hits at 1317 State St are dated soccer watch-party events, not the venue itself) |
  | Santa Barbara Public Market | ✅ `afd623d6-45fd-5eed-b16e-b3a485d1cba0` |
  | The Book Den | ✅ `f97fd218-c1a5-53ff-b3d7-ee04faefb24f` |
  | Santa Barbara County Courthouse | ✅ `c671bb72-7339-5cf1-99e8-68626d408be1` |
  | La Arcada Courtyard | MISS → label-only |
  | El Presidio de Santa Barbara | MISS → label-only |
  | Palihouse | MISS → label-only (as the spec flagged as most likely) |
  | Paloma | MISS → label-only |

  All 6 misses ship with the spec §3 authored `sub`/`maps_query` fallback, no
  fabricated thing/lat/lng. Flagged to Jim for optional catalog adds (spec §4a).
- **`components/discover/StateStreetSketch.tsx`** (new) — base SVG sketch (360×330
  viewBox), ported from the mockup verbatim: mountains, 3-vertical/5-cross street grid
  + labels, 3 palms, 7 hand-drawn landmarks (Public Market awning, Arlington facade,
  Courthouse tower + ✵, La Arcada arch + fountain, Book Den book, El Presidio adobe +
  bell, Paloma neon dove) plus the Palihouse cocktail glass (spec §5), insider callouts,
  beach vignette, ocean + sailboat + Stearns Wharf, compass, rotated STATE STREET stamp.
  Zero raw hex — every mockup color mapped to its v9 token; the one mockup hex with no
  exact token match (`#B0763A`, the cocktail-glass stroke) mapped to the nearest
  fills/borders-only token (`--tile-light`) rather than introduced as new. No marker
  circles (overlay layer, same pattern as Funk Zone).
- **`lib/guide-art.ts`** — `state-street` entry added: 9 marker coordinates + secretMark
  `(271, 114)` per spec §5, all verbatim from the mockup viewBox.
- **`lib/guides.ts` + `app/(app)/discover/[id]/page.tsx`** — added `shortGuideTitle()`
  (strips a trailing parenthetical qualifier, e.g. "State Street (First-timer)" →
  "State Street"; a no-op for titles with none, e.g. "The Funk Zone"). Wired into the
  identity-header `h1`, the title-block `h2`, the sticky bar `who`, and the passport
  `lbl`/aria-label, resolving spec §8.5 ("title vs. derived short label") to its
  recommended default. Also fixed a pre-existing hardcoded aria-label ("Right now in
  the Funk Zone") that would have mislabeled every other guide's now-block; it now
  reads the guide's own short title. Unit tests added in `lib/guides.test.ts`.
- **Verification:** `lib/guides.test.ts` (16 tests, 2 new for `shortGuideTitle`) and
  `tsc --noEmit` clean on every
  touched file. RLS blocks the anon key from reading `status='draft'` rows at all
  (`public_read_guides`/`public_read_guidestops` policies), so `/discover/[id]` can't
  render a draft guide through the normal public path. With Jim's go-ahead, briefly
  flipped `status` to `'published'` via the service-role key, screenshotted at 390px
  and 1280px, then immediately reverted to `'draft'` (no code change, no lingering
  state; the toggle script was thrown away after use). Screens matched the mockup:
  sketch map, chapter accordion (collapsed + hint pill), asides, take card,
  know-before, passport slab, colophon, no console errors.
- **Deferred, not built (spec §0/§6):** Phase 3 (been-loop, stamps, gold ring, postcard
  reveal) and Phase 4 (hub passport spread) — `✓ Been` stays static, per Funk Zone. The
  optional §6 Funk Zone chapter-card treatment (collapsed-terracotta/open-plaster) was
  left out; it's a cross-guide consistency pass, not required to ship this guide.
- **Holding for Jim (spec §8, blockers to publish only, not to seed-as-draft):** the
  planted ✵ wrong time detail on the stop-5 (Courthouse) note, `now_note` +
  `now_note_on`, the publish flip, and Palihouse's public walk-in cocktail hours /
  catalog add.

---

## 2026-07-05 — Welcome Tour (first-run onboarding carousel)

Source: `docs/intro-tutorial/01_welcome_tour_build_spec.md`. Built the 3-panel welcome
carousel (what it is → save (want) → remember (been)), gated on `sbd.tour.v1` +
`useSaves().hydrated` + saves/itineraries emptiness (the existing-user launch guard),
plus two replay entries and two copy alignments. All five stop-and-show gates verified
at 390px and 1280px (screenshots, Playwright-driven gating/keyboard/reduced-motion
checks), tsc + eslint clean.

- **New:** `components/tour/TourProvider.tsx`, `WelcomeTour.tsx`, `useTour.ts`.
- **Modified:** `components/ui/BottomSheet.tsx` (added an optional `ariaLabel` prop),
  `app/(app)/layout.tsx` (mounts `TourProvider` inside the existing `SavesProvider`
  tree), `app/components.css` (`.sbd-tour*` block, tokens only), `components/explore/
  ExploreClient.tsx` (footer replay link), `components/saved/SavedClient.tsx`
  (empty-Saved replay link, em dash removed from the empty message, new C2 supporting
  line).

**Reconciliations (repo is truth for paths — spec drift, not a design change):**
- Spec named `CascadeFeed.tsx` for the footer replay link; the real Explore footer
  (signup + trust line + submit link) lives in `ExploreClient.tsx`. Built there.
- Spec's mockup joined "Submit a happening · How SB Daymaker works" in one row with a
  dot separator; the live copy is longer ("＋ Submit an event or business"), so a forced
  single row wrapped and orphaned the dot at both 390px and 1280px. Stacked the two
  links using the footer's existing vertical rhythm instead — no separator needed.
- `BottomSheet` only exposed `title`/`kicker` (and `aria-label` was hardwired to
  `title`, which also renders a visible `<h2>`); the tour sheet has no heading, per the
  mockup. Added the optional `ariaLabel` prop so the accessible name doesn't force a
  visible title — every other `BottomSheet` caller is unaffected.
- Spec's own §10 CSS sizes the carousel dots at 7px (20px active) to match the mockup,
  which conflicts with its own §12/Gate-5 44px tap-target floor. Kept the visual dot
  exactly as spec'd and added an invisible 44×44px `::before` hit area, so the
  pixel-accurate look and the a11y floor both hold.

**Known, not fixed:** `TourProvider`'s auto-open effect trips
`react-hooks/set-state-in-effect` (setState called synchronously in a mount effect
that hydrates from `localStorage`). `SavesProvider.tsx`'s own hydration effect has the
identical, already-shipping warning — matched existing precedent rather than
restructuring around it.

---

## 2026-07-04 — Living Postcard Phase 2 (Funk Zone guide seeded, full rich-guide page built, published)

Source: `docs/discover-sb/` spec + approved content-model paper (Phase 1 foundation).
The Funk Zone is the first Living Postcard guide: 9 stops (7 thing-backed, 2 label-only),
sketch art, chapter accordion, passport slab, take card, know-before section, secret tease.
Jim approved at stop-and-show 2026-07-04.

- **Seeded:** `seed_funk_zone_guide.mjs` — guide row (ID `852bc0ee-bf50-5312-8588-1a57a3903ea7`,
  `stamp_code='FZ'`, `refreshed_on='2026-07-01'`, `status='published'`) + 9 `guide_stops`
  (positions 1-9; stops 3 + 9 are label-only with `maps_query` set; stops 1,2,4-8 are
  thing-backed). Also `seed_funk_zone_things.mjs` for the 3 things that weren't in the
  catalog (Helena Avenue Bakery, Lucky Penny, The Lark).
- **`components/discover/FunkZoneSketch.tsx`** (new) — base SVG sketch (360×330 viewBox):
  train tracks, 5 vertical streets + 3 horizontal streets + labels, coastline + Pacific
  label, STEARNS WHARF → siding, terracotta dashed route, ✵ gold glyph, THE FUNK ZONE
  rotated plate, compass rose. No marker circles (those are the overlay layer).
- **`lib/guide-art.ts`** (new) — sketch/emblem asset registry. `GuideArt` interface with
  `Component` + `markers` (raw SVG x/y in 360×330 viewBox) + `secretMark`. `funk-zone`
  entry populated with 9 marker coordinates. `getGuideArt(id)` lookup.
- **`components/discover/GuideWalkSection.tsx`** (new, `"use client"`) — full walk UI:
  sketch plate + marker overlay SVG (terracotta circles, tap-to-jump-to-chapter);
  chapter accordion (all closed by default, first chapter gets a floating "CLICK TO
  DISCOVER THESE STOPS" hint pill that dismisses on first tap); stop cards (label, sub-line,
  ⌖ DIRECTIONS link, note, ✓ Been button disabled/static, heart save); "From a local"
  asides between chapters; floating ⌖ Sketch pill. `artId: string | null` prop (not
  `GuideArt`) — functions cannot cross the RSC/client boundary.
- **`app/(app)/discover/[id]/page.tsx`** rebuilt — rich branch renders: sketch plate +
  walk section (`GuideWalkSection`), title block with meta chips, sticky bar, passport
  slab (zero-state, `stamp_code` gated), take card, know-before section, colophon.
  Plain-guide branch (no `content.chapters`) preserved unchanged. `getStopThingMap()`
  called server-side to derive `StopDisplay[]` (sub-line + directions URL per stop).
- **House copy rule applied:** zero em dashes in any rendered user-facing string
  (commas, colons, or periods used instead). DB content was already clean.
- **UX:** first chapter band gets a floating tooltip hint on initial render, dismissed
  on first chapter tap. Walk description gets `margin-bottom: 44px` to clear the hint
  at all viewport widths.
- **`supabase/migrations/20260704_guides_content_model.sql` +
  `supabase/migrations/20260704_rainy_day_tag.sql`** — Phase 1 DDL (applied to DB
  2026-07-04, now checked in).

---

## 2026-07-04 — Living Postcard Phase 1 (guides content model — code + migrations, DDL pending Jim)

Source: `docs/discover-sb/Phase1_Spec_Guides_Content_Model.md` (authority chain:
CLAUDE.md v10 → the approved Funk-Zone content-model paper). Additive-only, no UI
this phase; the phase gate is a byte-identical `/discover` render after migration.

- **Two migration files written (▶ Jim pastes — no DDL run from code):**
  `supabase/migrations/20260704_rainy_day_tag.sql` adds the `rainy_day` value to
  the `occasion_tag` enum, isolated in its own file (a new enum value can't share
  a transaction with statements that use it). `supabase/migrations/20260704_guides_content_model.sql`
  adds 5 columns to `guides` (`stamp_code` + `[A-Z]{2}` check + partial unique
  index, `refreshed_on`, `now_note`, `now_note_on`, `content jsonb not null default
  '{}'`) and 3 to `guide_stops` (`chapter smallint default 1` + `>=1` check, `sub`,
  `maps_query`). Idempotent throughout; new columns ride existing RLS.
- **`lib/guides.ts` — types + pure helpers (no query/UI wiring):** `GuideContent`
  type encoding the approved jsonb model **verbatim** (paper §A3: `meta.{distance_mi,
  plan_hrs}`, `chapters[].{k,name,sum,tod}`, `asides[].{after_chapter,text}`,
  `take.{h,items[].{b,rest},landing}`, `know_before[].{k,v}`, `postcard_captions`
  buckets, `secret_tease`, `sketch.{kind,asset,no}`) + tolerant `parseGuideContent`
  (empty `{}` → plain v1 guide, unknown keys ignored, wrong types coerced, `tod`
  validated against morning|afternoon|golden|evening, never throws);
  `deriveStopSub` (thing-backed → street·category·price with null segments omitted;
  label-only → stored `sub` verbatim); `directionsUrl` (maps_query → coords → null).
  Existing `getPublishedGuides`/`getGuide`/`matchGuideThings` left **byte-identical**
  — selects deliberately NOT widened, so the render is provably additive.
- **`lib/guide-art.ts` — sketch registry scaffold:** types + `getGuideArt(id)` lookup
  that returns null for every id (registry ships empty; the funk-zone SVG is Phase 2).
- **Tests:** `lib/guides.test.ts` — 14/14 green (parseGuideContent empty / full Funk-Zone
  §A3 content / emblem kind / malformed / tod validation; deriveStopSub five cases;
  directionsUrl three branches). `tsc --noEmit` clean for the touched files.

**Settled-call note:** the paper's Part A prose calls stop `sub` "authored, not derived,"
but the spec header records this as a settled judgment call resolved the **other** way —
"sub-lines auto-derive from thing data (`sub` column = label-only-stop fallback ONLY)."
`deriveStopSub` implements the spec's settled call. Derived category uses `things.category`
verbatim (e.g. "food"), not the mockup's editorial forms ("Science museum") — those are
[P2] authoring, out of scope here.

**Open (not blockers):** (1) §5 render proof (seed one plain guide, screenshot 390/1280px)
needs the migration applied + dev server → **pending Jim**; structurally the render is
unchanged (no page or query touched). (2) DDL pasted by Jim: **[pending]**. (3) Provenance:
paper committed at `docs/discover-sb/Phase1_Content_Model_FunkZone_Paper.md` (alongside the
spec); note spec §6 named `docs/discover-living-postcard/` — kept in the arc's actual folder.

---

## 2026-07-04 — W2.3 Image variety (Feed Quality, phase 3 of 3 — closes the wave)

Source: `docs/platform-enhancements-july4/W2_SBDaymaker_Feed_Quality_Build_Spec.md`
(Phase W2.3). A bridge until the motif SVG library; waterfall order + Google gate/cap
untouched.

- **Category-aware queries** (`ingest/images.ts`): new exported `CATEGORY_QUERY` map keys
  a search phrase off `happening_category` (live_music → "live band small venue stage",
  recurring_market → "farmers market produce stall california", etc.), appended to the
  title so per-title variety survives while imagery gains relevance. Civic-meeting items
  route to a neutral placeholder instead of misleading stock — new `isCivicImage()` reuses
  the W2.1b `classifyWeight` classifier; when true, `resolveImages` skips the network
  entirely (`found` stays empty → placeholder). Comment notes the motif library supersedes.
- **Per-batch URL dedupe** (`resolveImages`): new pure `pickUnused(options, used)` bumps
  the first not-yet-used url to the front (placeholder always last), repeating a url only
  when every option is taken. The run's `used` set is seeded from a cheap `image_cache`
  scan (`loadOverusedUrls`, urls on >3 places) so fresh picks steer away from photos that
  are already everywhere. Cache writes unchanged.
- **Targeted re-resolve** (`ingest/run.ts` `REPEAT_BACKFILL=1` + `ingest.yml` input):
  finds `photo_url`s shared by >3 published things and re-runs just those through the
  resolver with `force:true` + the new variety logic; prints offenders, distinct-photo
  before→after, and `image_spend` before→after. Free-tier only in practice (Google gate/
  cap code path untouched).

**Tests:** `ingest/images.test.ts` +10 (category template selection + differentiation +
fallback; `isCivicImage`; `pickUnused` dedupe incl. all-used fallback) — 16/16 green.

**Live-data finding (the problem is BIGGER than the spec's "six times" — reported honestly):**
520 published things carry only **152 distinct photos**; **32 photos are each shared by >3
things**, covering **363 rows (~70% of the catalog)**. Worst offenders: one Pexels photo on
**100** things, then ×49, ×26, ×21, ×13. `image_spend` this month is **0 Google calls / $0**
(all free tier). **Not run here:** local `.env.local` has no `PEXELS_API_KEY` (so a local
re-resolve would only yield placeholders) and `tsx` can't execute in this sandbox — recommend
Jim run `REPEAT_BACKFILL` via the nightly Action (which holds the Pexels secret); expect the
distinct-photo count to jump sharply with `image_spend` staying at 0.

**Wave W2 status:** all three phases (W2.1 editorial weight · W2.2 tag quality · W2.3 image
variety) built + unit-tested. Pending human/Action steps consolidated: run the weight backfill
(DONE — 7 civic items), `ENRICH_BACKFILL` (1 untagged row), and `REPEAT_BACKFILL` (image
variety) via the GitHub Action; optional cockpit cleanup of family_day on 4 breweries.

---

## 2026-07-04 — W2.2 Tag quality (Feed Quality, phase 2 of 3)

Source: `docs/platform-enhancements-july4/W2_SBDaymaker_Feed_Quality_Build_Spec.md`
(Phase W2.2). Three changes to `ingest/enrich.ts` + the enrich backfill; model,
chunking, timeout, and tool schema untouched (prompt text + one code rule only).

- **Rubric tightening** (`SYSTEM` prompt): added a "Tagging rubric" block with three
  anti-examples — alcohol-primary venues default to `wine_food`/`nightlife` not
  `family_day`; civic/government meetings get few or no tags; `family_day` requires
  genuinely family-oriented programming, not "a family could attend." Voice/format kept.
- **New AI-only negative rule** (`applyNegativeRules`): strips `family_day` from the
  MODEL's proposed tags when the title matches
  `\b(brewer|brewing|taproom|winery|wine bar|tasting room|distiller|cocktail|pub)\b/i`.
  **Deliberately AI-only** — it lives inside `applyNegativeRules` (the enrich path),
  NOT the publish-time `review.filterTags`, so the founder can still add `family_day`
  in the cockpit for genuine cases (M Special's cornhole + food trucks). `applyNegativeRules`
  gained an optional `title` field (back-compat: omitting it skips the alcohol rule).
- **Backfill extended** (`ingest/run.ts` `ENRICH_BACKFILL`): selection widened from
  "needs_review with null blurb" to "published/needs_review missing blurb **or** zero
  tag rows." A blurb is written only when the row had none (founder-edited blurbs are
  never overwritten — tags-only enrich for already-blurbed rows); `landTags` stays
  idempotent. Enrich still never sees `starts_at`; audit rows still written per draft.

**Tests:** `ingest/enrich.test.ts` +4 (brewery loses AI `family_day`; non-alcohol keeps
it; title optional/back-compat; M Special sanity) — 13/13 green.

**Live-data reconciliation (the spec's premise was stale — reported honestly):** the spec
expected ~179 untagged rows (baseline 413/592). The **current live DB is already ~100%
tagged: 519/520 published, 2.30 tags/thing, exactly 1 untagged** (`LOTG | Leadbetter
Beach`). So the backfill is now a near-no-op (1 row) rather than a mass fill — the code is
still correct and catches that row + any future gap. `family_day` returns **264 diverse
items** (concerts, MOXI, farmers markets, preserves), **not** taproom-dominated. The
brewery mis-tag is real but tiny: **5 breweries carry `family_day`** (Topa Topa, M Special,
Figueroa Mountain, Third Window, Island) — 5/264 ≈ 2%. Per the rule's AI-only design these
existing rows are a **founder cockpit call** (M Special legitimately keeps it); the new rule
prevents *new* brewery `family_day` tags going forward but deliberately does not rewrite
history. **Not run here:** `tsx` can't execute in this sandbox (Node 24); recommend Jim run
`ENRICH_BACKFILL` via the nightly Action to tag the 1 remaining row, and optionally clear
`family_day` from the 4 non-M-Special breweries via the tag editor (a 2-second toggle each).

---

## 2026-07-04 — W2.1 Editorial weight (Feed Quality, phase 1 of 3)

Source: `docs/platform-enhancements-july4/W2_SBDaymaker_Feed_Quality_Build_Spec.md`
(Phase W2.1). The `things.editorial_weight` column (smallint −5..+5, already in the
schema) is now **consumed** — the first time the ranker reads a curation field.

**TRUST RULE (§2.8 / schema §A7):** `editorial_weight` is explicitly-permitted founder
curation. `cascade()` still never reads `is_featured` / `sponsor_id`; a regression test
sorts a fixture with those fields set adversarially and asserts identical order. **No
DDL.** No AI at request time; the only AI in the wave is the unchanged nightly enrich.

- **W2.1a — ranking** (`lib/explore.ts`): `cascade()` now sorts per tier — negatives
  sink to the bottom of their tier section (visible, never hidden); Tier-1 keeps
  `starts_at` asc primary with `editorial_weight` desc as the same-start tie-break;
  Tier-2/3 sort by `editorial_weight` desc; all ties fall back to stable input order.
  New shared pure `pickAutoHero(ordered, sbTodayKey)` prefers today's highest positive-
  weight Tier-1 item (tie → soonest), else `ordered[0]`. Wired into **both** the public
  `ExploreClient` hero memo (after the founder pin) and `heroServer.ts`'s projected
  "Auto" rail — imported, never forked, so the two can't diverge. `editorial_weight`
  added to the `Thing` type + `BASE_COLS` and to heroServer's `STAR_SELECT`.
- **W2.1b — civic classifier** (`ingest/weight.ts`): pure `classifyWeight()` returns
  −3 for committee / commission / advisory-board / board-meeting / public-hearing /
  agenda-review / city-council / task-force / study-session / subcommittee titles
  (word-boundary, case-insensitive), else 0. Runs at gate time (carried on
  `Candidate.editorial_weight`, landed by `land.ts`). One-time `WEIGHT_BACKFILL=1`
  branch in `ingest/run.ts` (+ `ingest.yml` input) downweights existing
  published/needs_review weight-0 rows and writes one `audit_log` row per change
  (`action:'weight_auto'`, `actor:'rule'`). Accepted false positive: promotional
  "…Committee Presents…" — a founder ▲ fixes it in two seconds.
- **W2.1c — cockpit ▲/▼**: `POST /api/admin/weight` (admin-gated, integer clamp
  −5..+5, service-role update, `audit_log` `weight_set`/`founder`, `revalidatePublic()`).
  Shared `WeightNudge` control (44×44 buttons, aria-labels, optimistic + revert-on-error
  toast, disabled at clamps, tokens only) on each Live-catalog row and the Queue
  `ReviewCard`. Metadata-immediate like `hero_eligible` — no re-review. `editorial_weight`
  added to `CatalogRow`/`QueueRow` + their selects.

**Tests:** `lib/explore.test.ts` (ordering, hero pick, trust regression) +
`ingest/weight.test.ts` (classifier true/false + edge cases) green — 390/391 vitest pass.

**Carry-over / pending human steps:**
- **Run the one-time weight backfill** (GitHub Action → nightly-ingest → tick
  `weight_backfill`, or `WEIGHT_BACKFILL=1 npx tsx ingest/run.ts` with service-role env)
  and report the count — expected to catch a slice of the ~210 `community_gathering` rows.
- Pre-existing, unrelated blockers (not introduced here): `npx next build` is still
  blocked by the untracked `docs/platform-snapshot/06_crown_jewels/*.tsx` snapshot
  (broken relative imports — the Wave-1 docs-snapshot blocker); W2.1 app code compiles
  and `tsc --noEmit` is clean outside that folder. `ingest/adapters/independent.test.ts`
  fails only on a clock-year rollover (year-less "Jun 27" → 2027), also untouched here.

---

## 2026-07-04 — Product cut: One Perfect SB Day scrapped; Plan confirmed CTA-only

Source: Jim, direct decision (follow-up to the Canon v10 reconciliation below).
Documentation-only; no code touched.

- **One Perfect SB Day / the "Make My Day" express button — SCRAPPED.** Removed from
  the product; do not build it on Explore or Plan. `CLAUDE.md` updated: the §3 v10-note
  OPD bullet now reads *scrapped*, the §9 Explore bullet's OPD parenthetical is removed,
  and the §9 Removed list adds it. `OnePerfectDayCard` is confirmed **orphaned dead code**
  and no "Make My Day" button exists — code already matches; this records the decision.
  *Rationale: Jim cut the feature.*
- **Plan is CTA-reached, not a bottom-nav tab — confirmed against production.** `BottomNav`
  TABS = three (Explore · Saved · Discover SB); the Plan icon stays dormant. CLAUDE.md's
  header and v10 note already state this; the banners in `START_HERE.md` and
  `00_SBDaymaker_Project_Context.md` were sharpened so "four sections" can't be misread as
  "four tabs." *Rationale: keep the four-section framing honest about the nav.*

---

## 2026-07-03 — Canon v10 reconciliation (Doc WC)

Source: `docs/canon-v10/WC_SBDaymaker_Canon_v10_Build_Spec.md`. Documentation-only
session: `CLAUDE.md` bumped **v9 → v10** to match the shipped product (a full audit
found canon forbidding a surface that is live). No application/schema/behavior
changes. Every drift below was **re-verified against the live repo** (Wave 1 had
landed since the spec was written at `caa7302`) and canon states what is true today.

- **A1 — four sections, not three.** Header, §3 wireframe row, the v9→**v10 note**, and
  §9 now declare **Explore · Saved · Discover SB · Plan**. Plan is described as-shipped
  (questionnaire → deterministic ranked, editable spine → Share + Clear; pure
  `rankCandidates`/`buildDraft`; `/p/[token]` `shared_plan`) and the "My Plan itinerary
  builder — do NOT build" language is retired. Genuinely-dead components stay listed as
  do-not-revive (`SwapSheet`, `PinPickerSheet`, `DayShapeSelector`, drum-roll picker,
  `.ics`). *Rationale: canon forbade a surface that ships in production.*
  *Verified-and-corrected: Plan is **CTA-reached, not a bottom-nav tab** — `BottomNav`
  TABS has three entries + a dormant Plan icon; the spec's "Plan tab in BottomNav" was
  inaccurate, so canon says CTA-reached.*
- **A2 — cron topology.** §4 now says the nightly ingest is a **GitHub Action**
  (`.github/workflows/ingest.yml`, 09:00 UTC, `npx tsx ingest/run.ts`); the only Vercel
  cron is the **weekly reaper**; `/api/cron/nightly` is a deprecated no-op. Added a "why"
  note (isolation + 20-min timeout + GH secrets) so it isn't moved back. *Rationale:
  canon claimed Vercel Cron ran the pipeline.*
- **A3 — cockpit at `/admin/*`.** §4 records the live console as **`/admin/*`**
  (Queue · Coverage · Live catalog · Hero plan), `/cockpit/login` as current login, and
  `/cockpit` → `/admin/review` redirect — flagged *current, not final (Wave 4 relocates
  login)*. *Rationale: canon referenced a stale cockpit path.*
- **A4 — analytics installed.** §4 updated from "in the stack" to **installed (Wave 1)**:
  `@vercel/analytics` mounted in `app/layout.tsx`, seven custom events via
  `lib/analytics.ts`, inert until the dashboard toggle is enabled. *Rationale: it was a
  bare stack claim; Wave 1 W1.2 made it real.*
- **A5 — known-open ledger (new §10).** Added a "do not silently fix — see Doc 19" block:
  unbuilt subscriber edition sender, unseeded Discover guides, no happy-hour windows,
  legacy `lib/pipeline.ts`/`lib/enrich.ts` duplicate (Wave 4), incomplete migrations tree
  (Wave 4), `sbd.itineraries.v1` store collision (Wave 4). *Rationale: keep sessions from
  "helpfully" fixing tracked, out-of-scope items.*
- **A6 — new working rule §8.9.** "`react-hooks/exhaustive-deps` is never disabled without
  a comment proving the omitted dependency is inert." *Rationale: five silent disables in
  one file shipped the been-marking regression (W1.1).*
- **A7 — model pinning visible.** §4 records the pinned nightly enrich model
  **`claude-haiku-4-5`** (`ingest/enrich.ts`) so drift from the "exact IDs, never latest"
  rule stays visible. *Rationale: the pinned string wasn't recorded anywhere in canon.*
- **A9 — stale banners.** One-line v10 banners added under the status lines of
  `START_HERE.md` and `00_SBDaymaker_Project_Context.md` (bodies untouched). *Rationale:
  both still open with "three sections."*

**Flagged for Jim (drifts the spec did not cover — not amended on my own judgment):** (1)
`OnePerfectDayCard` is orphaned and no "Make My Day" button exists, so One Perfect SB Day
renders nowhere live — the §3 v10-note OPD bullet was left as-is pending your call; (2) the
spec's A1 evidence "a Plan tab in `BottomNav`" is inaccurate against current code (three
tabs) — canon written to code.

---

## 2026-07-03 — Wave 1 (W1.4): email the save-restore magic link

Source: `docs/wave-1-fixes/W1_SBDaymaker_Wave1_Build_Spec.md` §W1.4. The magic-link
backup now **emails** the restore link instead of only displaying it. New route
`app/api/restore-link/route.ts` (`force-dynamic`) validates `{ email, saves }`
(email contains `@`; `saves` a plain object, ≤500 entries, values exactly
`want|been` → else 400), creates the snapshot via the existing **anon-client**
SECURITY DEFINER RPC (`create_save_restore` — never service-role), then
`sendEmail`s the `/r/{token}` link and returns `{ ok, token, sent }`. `RestorePanel`
POSTs it and branches on `sent`: inbox message + copy fallback, or copy-only when
email is unconfigured. Restore **merge** semantics (`incoming wins`) are unchanged.

**Why:** the half-built backup showed a link to copy but never sent it.

**Accepted, on the record:** this public route (like `/api/subscribe`) can be made
to email an arbitrary address — content is fixed/non-sensitive; **rate limiting is
deferred to Wave 4** (comment in-route). The email/token are **never logged**. When
`RESEND_FROM`/domain verification is absent, `sent:false` degrades to copy-the-link.

---

## 2026-07-03 — Wave 1 (W1.3): Explore correctness — day-aware Tier-2 + hero never-blank

Source: `W1_SBDaymaker_Wave1_Build_Spec.md` §W1.3. Two front-page fixes in
`lib/explore.ts` + `components/explore/` (cascade sort keys untouched; no sponsor
reads). **W1.3a:** on the **Today** horizon only, a Tier-2 (recurring / happy-hour)
thing passes iff a schedule row matches today's **SB weekday** (`sbDayOfWeek`, 0=Sun
per schema, derived from `sbDay` + a UTC-anchored date to dodge DST). Week/Month keep
pass-all; Tier-3 untouched. **W1.3b (constraint C5):** the hero can never go blank —
Layer 1 picks a Tier-3 evergreen from the full pool, deterministically rotated by SB
date (`pickEvergreenFallback`), with a soft "Nothing matches that exactly today" note;
Layer 2 is a hardcoded static card (**"The Courthouse clock tower"** → `/discover`, no
save heart) when the pool has zero evergreens.

**Why:** a Sunday market showed on a Thursday, and a filtered-empty view could blank the marquee.

**Approximation accepted:** `biweekly`/`monthly` frequency is matched as "every
occurrence of that weekday" (a "1st Thursday" item shows every Thursday) — the feed
does **not** expand occurrences (`lib/occurrences.ts`), keeping it cheap/deterministic;
same feed-vs-coverage divergence, noted in-code. Schedule-less Tier-2 passes on Today
(can't prove it's off-day). One minimal token-only CSS rule added (`.sbd-hero__pick-note`).

---

## 2026-07-03 — Wave 1 (W1.2): Vercel Web Analytics + seven custom events

Source: `W1_SBDaymaker_Wave1_Build_Spec.md` §W1.2. Added `@vercel/analytics` (the
wave's only new dependency; installed with `--legacy-peer-deps` — its *optional*
`@sveltejs/kit` peer conflicts with the repo's vite@7, irrelevant to a React app).
`<Analytics />` mounts once in `app/layout.tsx` (cookieless, no consent banner —
matches §4). Exactly **seven** events fire through a typed, throw-safe wrapper
(`lib/analytics.ts`): `save_add`, `save_been`, `share_create`, `share_open`,
`lens_select`, `plan_built`, `subscribe_submit`. Save events fire in `SavesProvider`
(one seam covers every surface), read prior state via a ref so `track` sits **outside**
the updater (no StrictMode double-fire).

**Why:** the app shipped with zero telemetry; WAU is the north star and nothing computed it.

**PII discipline (constraint):** the overload signatures make it a compile error to
pass anything but ids/enums/counts — **no email, token, URL, or free-text** in any
payload. `<Analytics />` stays inert until the Vercel dashboard toggle is enabled
(a human step; not code-detectable).

---

## 2026-07-03 — Wave 1 (W1.1): fix the been-marking stale-memo regression

Source: `W1_SBDaymaker_Wave1_Build_Spec.md` §W1.1. `components/saved/SavedClient.tsx`
derived its lists from save **values** but keyed the memos on save **keys**, so a
`want→been` flip served stale cached arrays (item stayed under "Want"). Restructured
into pure, tested selectors in `lib/savedView.ts` (`filterByState`, `splitPast`,
`beenList`) taking the saves **map** as an explicit argument; `SavesProvider` now
exposes the raw `saves` map; the memos key on it. **All five `exhaustive-deps`
suppressions removed** and the file lints clean with the rule active.

**Why:** the keystone input to the memory moat (been-marking) was broken in production.

New unit suite `lib/savedView.test.ts` encodes the flip as a value-sensitivity contract
(a new-map `want→been` must re-derive) so this class of bug can't silently return. No
behavior change beyond the fix; the C2 card, dismissal, and been-ack toast are untouched.

---

## 2026-07-02 — Explore horizon toggle: de-crowded labels

Shortened the time-range segmented-control labels "This Week" → "Week" and "This Month"
→ "Month" (label-only; horizon keys `today`/`week`/`month` and all filtering unchanged).
Fuller phrasing preserved as per-button `aria-label`s (Label-in-Name). Presentation only.

---

## 2026-07-02 — Explore Hero: "One Front Page" (Phases 1–2)

Source: `docs/hero-visual-update/hero-one-front-page-spec.md` (v3 FINAL). Built and
approved at the spec §4 checkpoint. Amendments per spec §6:

1. **Reversed** — Phase 7 lock "top-banner feature lead retained for the Today
   opening card" → Today now opens in the standard left-rail `ListCard` format;
   the hero pick is the **sole marquee**. (Doc 18, Assessment Option B.)
2. **Restored** — hero pick card canon dress: context-aware eyebrow, venue + time
   meta line, CTA affordance, and the condition-chip freshness row. This corrects
   build drift; it is not a new decision.
3. **Added** — the signature Santa Barbara skyline SVG (`public/hero/sb-skyline.svg`,
   final art v3: faithful Mission, lawn + paseo foreground, dense Riviera hillside,
   Lil' Toot easter egg) extends the CLAUDE.md §5 signature element. Its fixed scene
   hexes are sanctioned as **non-token scene art** (full palette in spec §3.4) and
   must not migrate into `sbdaymaker_tokens.css`. Sun corridor + card-zone reserve
   rules per spec §3.2–3.3.
4. **Superseded** — canon's 96px hero-card image panel → the built **84px**
   body-driven panel stands (Hero Dimension Audit; code is truth on this dimension).
   Hero `min-height` canon value updated **228 → 352px**.

**Deferred, on the record (spec §6.5):** the Editor's Line (Phase 3 — gated, requires
Jim's explicit go + a separate delta spec) · the Shifting Pick (revisit after "Did You
Make It?") · the full Masthead layout (declined; the golden-hour countdown chip shipped
instead).

**Implementation reconciliations (repo is truth for paths):**
- Skyline served as an external `<img>` asset rather than inlined; spec §3.5 sanctioned
  either, and an external asset keeps the baked scene colors fully out of CSS.
- Spec §2.2 eyebrow used wireframe `cat` shorthand (`music`/`arts`/`happyhour`) with no
  literal in the 16-value `happening_category` enum. **Resolved to the site's true enums**
  (Jim's call): "Catch a show" ← `live_music`; "Arts & culture" ← `arts_theater` /
  `recurring_arts`; "Happy hour" ← thing `type === 'happyhour'` (no happy-hour category
  exists). Spec §2.2.1 amended to match.
