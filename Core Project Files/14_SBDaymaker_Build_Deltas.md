# SB Daymaker — Build Deltas Ledger

Canon amendments recorded as builds diverge from or extend the v9 canon
(`Core Project Files/CLAUDE.md`). Each entry cites the driving spec so canon and
code stay reconcilable. Newest first.

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
