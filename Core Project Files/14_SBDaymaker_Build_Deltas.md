# SB Daymaker — Build Deltas Ledger

Canon amendments recorded as builds diverge from or extend the v9 canon
(`Core Project Files/CLAUDE.md`). Each entry cites the driving spec so canon and
code stay reconcilable. Newest first.

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
