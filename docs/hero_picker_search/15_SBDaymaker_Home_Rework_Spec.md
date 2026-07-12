# 15 — SB Daymaker Home Rework Build Spec

> **Status:** Ready for Claude Code · **Type:** Delta spec (short, code-reconciled) · **Date:** 2026-07-11
> **Governing contract:** `Core Project Files/CLAUDE.md` (canon). Where this spec conflicts with live code, the code is truth: flag the conflict, do not blindly follow this document.
> **Source of truth for visual intent:** `SBDaymaker_Home_Final.html` (the approved mockup). This spec is the written contract; the mockup is the picture.
> **House style:** No em-dashes in any user-facing copy. Plain dollar signs in any copy. Design tokens only (no new hex). CSS convention `sbd-{component}__{element}--{modifier}`, `.is-active` for active state.

---

## 0. What this builds, in one paragraph

Rework the Explore home screen (`app/(app)/page.tsx` → `ExploreClient`) so that: (1) a deterministic search lives in the top-right of the header; (2) the daily hero pick card is removed from the skyline and replaced by fixed value-proposition copy set over the existing Santa Barbara skyline; (3) three photographic discovery doors (Place, Vibe, Activity) plus the time filter replace the old control row and pin beneath the header on scroll while the skyline scrolls away; (4) the retired daily pick returns as an elevated "Today's pick" card at the top of the feed. A new Activity taxonomy is introduced and populated by the existing batch-AI enrichment path.

---

## 1. Non-negotiable constraints (guardrails)

These override any convenience. Violating one is a stop-and-flag event, not a judgment call.

1. **The production skyline SVG is untouchable.** `/hero/sb-skyline.svg` (referenced in `components/explore/Hero.tsx`) must remain byte-for-byte identical. This rework repositions text over it and removes the pick card; it does not regenerate, optimize, recolor, or replace the asset. Do not run any SVG tooling against it.
2. **No per-request AI.** Search is fully deterministic (string matching). No Claude call is reachable from any public request handler. This preserves constraint C3.
3. **Additive-only DDL, human-applied.** Any schema change is additive (new nullable column, new default), written as a migration file for Jim to paste into the Supabase SQL editor. Claude Code never runs DDL against the hosted database.
4. **The Trust Rule holds.** The ranker never reads sponsor status. The new "Today's pick" is chosen by the existing sponsor-blind ranker plus founder pin logic. Search results are ordered deterministically (match quality, then recency), never by sponsor status.
5. **WCAG 2.2 AA is the floor.** Every new interactive element: visible focus ring, 44x44 minimum target, correct roles and labels, reduced-motion honored. Details in section 12.
6. **Design tokens only.** All color, type, spacing, radius, motion from `app/sbdaymaker_tokens.css`. No new hex values.
7. **No end-user accounts.** Filter and search state is ephemeral (in-memory or URL params). No new localStorage keys beyond the three that already exist.

---

## 2. Scope: what changes, what does not

**Changes**
- Header gains a search control (new).
- `Hero.tsx` stops rendering the pick card; renders value-prop copy instead.
- The control row (`ControlRow` + `TuneSheet`) is replaced by discovery doors + a rehomed time filter.
- The daily pick moves into the feed as an elevated card.
- New Activity taxonomy + tagging.
- Stacked (three-dimension) filtering.

**Does not change**
- The `/hero/sb-skyline.svg` asset.
- The cascade tier model (Tier 1 / 2 / 3), `CascadeFeed` section structure, `ListCard`, `RockGrid`, `LeadDayRail`.
- The saves system, share tokens, magic-link restore.
- The nightly ingest pipeline topology (only the enrich batch schema is extended).
- Bottom nav, Discover SB, Saved, Plan surfaces.
- The Build-your-day CTA (flagged in section 16 as a candidate for later removal, but out of scope here).

---

## 3. Current-state architecture (reconcile before building)

This is my read from the platform snapshot. **Phase 0 must confirm each item against live code and flag drift.**

- `app/(app)/page.tsx` loads published things (ISR ~10 min) plus weather plus `pinnedHeroId`, renders `ExploreClient`.
- `components/explore/ExploreClient.tsx` holds filter state: `lens: OccasionKey | null`, `horizon: Horizon`, `zone: Zone | null`, `tuneOpen: boolean`. Computes `ordered = nearMeSort(cascade(filterByLens(withinHorizon(things, horizon), lens)), zone)`. Computes `hero` (pinned pin if in view, else `ordered[0]`). Computes `feed = ordered without hero`. Renders `Hero`, `ControlRow`, `CascadeFeed`, footer with `EmailSignup`, and `TuneSheet`.
- `components/explore/Hero.tsx` renders the skyline SVG, a `__sky` zone (date + `ConditionChips`), and a `__pick` card.
- `components/explore/CascadeFeed.tsx` splits items by `happening_tier` into Tier 1 lead (today = `ListCard` list, week = `LeadDayRail`, month = `RockGrid`), a Build-your-day CTA (today only), and collapsible Tier 2 ("Every week") and Tier 3 ("Anytime in SB"). Has an `EmptyState` with an `onClearFilters` reset.
- `lib/explore.ts` exports `cascade`, `filterByLens`, `nearMeSort`, `withinHorizon`, and the `Horizon` type.
- `lib/occasions.ts` exports `OccasionKey`, `OCCASION_BY_KEY`. This is the Vibe dimension.
- `lib/zones.ts` exports `Zone`. This is the Place dimension.
- There is currently **no Activity dimension**. This is the gap Jim identified ("tagging is not as robust as required").

**Key architectural finding:** the three doors map cleanly onto the filter model. Place = existing `zone`, Vibe = existing `lens`/occasion, Activity = **new**. `lens` and `zone` already stack (both applied in the `ordered` memo), so stacked three-dimension filtering is adding one more `.filter()` plus one more piece of state.

---

## 4. Target architecture

`ExploreClient` state becomes: `place: Zone | null`, `vibe: OccasionKey | null`, `activity: ActivityKey | null`, `horizon: Horizon`, `sheetOpen: null | 'place' | 'vibe' | 'activity'`, `searchOpen: boolean`.

The ordered memo applies all three dimensions (stacked):
```
ordered = nearMeSort(
  cascade(
    filterByActivity(
      filterByLens(
        withinHorizon(things, horizon, nowMs),
        vibe),
      activity)
  ),
  place)
```
(Exact composition order to be confirmed in Phase 0; `nearMeSort`/`place` may need to remain outermost. Preserve current behavior for the two existing dimensions.)

`pick` continues to be computed as today (pinned pin in view, else `ordered[0]`), but is now passed **into** `CascadeFeed` to render as the elevated "Today's pick" at the top of the lead section. `Hero` receives no pick.

Render tree becomes: `Hero` (value-prop) → `DiscoveryControls` (doors + horizon, sticky) → `CascadeFeed` (with `pick` prop) → footer. Plus `DiscoverySheet` (portal/overlay) and `SearchPanel` (portal/overlay). `TuneSheet` and `ControlRow` are removed from the tree.

---

## 5. Data model changes (additive, human-applied)

Deliver one migration file, `supabase/migrations/15_activities.sql`, containing additive DDL for Jim to paste into the Supabase SQL editor. Do not execute it.

Required:
```sql
-- Additive: activity taxonomy tags on things. Nullable, defaults to empty.
alter table things
  add column if not exists activities text[] not null default '{}';

-- Optional index to support activity filtering at scale.
create index if not exists things_activities_gin
  on things using gin (activities);
```

Notes:
- `activities` holds one or more `ActivityKey` slugs from the controlled vocabulary in `lib/activities.ts` (section 6).
- Do not repurpose the existing `tags` column; keep `activities` separate so the Activity door has a clean, controlled source distinct from free-form tags.
- If Phase 0 finds an existing suitable column, flag it and propose reuse instead of adding a column.

---

## 6. Taxonomy and tagging

### 6.1 Activity registry (founder-maintained)

Create `lib/activities.ts`, mirroring the pattern of `lib/occasions.ts` and `lib/zones.ts` and the `recurringRegistry.ts` founder-file convention. It defines the controlled Activity vocabulary: a stable `ActivityKey` union, a display label, a short description, and a tile image path per activity.

Starter set (confirm and refine with Jim; keep to a tight, curated list, not an exhaustive one):
`live-music`, `arts-galleries`, `food-drink`, `outdoors`, `markets`, `family-kids`, `clubs-groups`, `film-talks`, `wellness-fitness`, `nightlife`.

Each entry:
```ts
{ key: 'live-music', label: 'Live music', tile: '/tiles/activity/live-music.jpg' }
```

### 6.2 Populating activities via batch AI (existing path)

Extend the existing batch enrich tool schema in `ingest/enrich.ts` (the live batch path, `claude-haiku-4-5`, `tool_choice` forced to `enrich_batch`) so each enriched item also returns zero or more `activities` keys from the controlled vocabulary. Constraints:
- The model must choose only from the `ActivityKey` union (pass the vocabulary in the tool schema as an enum). Reject and drop any value not in the vocabulary at write time.
- This rides the existing nightly batch. No new per-request AI.
- Backfill existing published rows via the existing enrich-backfill flag (`ENRICH_BACKFILL=1` → `backfillEnrich`). Confirm the backfill path writes `activities` for already-published rows.

### 6.3 Tile imagery (content dependency, flag to Jim)

The doors and sheet tiles are photographic. This needs founder-curated images:
- Place tiles: one image per `Zone`, at `/public/tiles/place/{zone}.jpg`.
- Vibe tiles: one image per `OccasionKey`, at `/public/tiles/vibe/{occasion}.jpg`.
- Activity tiles: one image per `ActivityKey`, at `/public/tiles/activity/{activity}.jpg`.

Ship the build with a graceful fallback: any missing tile image renders a token-colored tile (per-dimension accent) with the label only, so the feature works before all imagery exists. **Flag the image list to Jim as a content task; do not block the build on it.**

---

## 7. Component inventory

**New**
- `components/explore/SearchButton.tsx` — the magnifier in the header.
- `components/explore/SearchPanel.tsx` — the overlay: field + scrim + deterministic results.
- `lib/search.ts` — deterministic match logic (title, venue, tag).
- `app/api/search/route.ts` — public GET endpoint, deterministic, lightly rate-limited.
- `components/explore/DiscoveryControls.tsx` — the sticky wrapper: doors + chip bar + horizon segment.
- `components/explore/DiscoveryDoors.tsx` — the three photographic pills.
- `components/explore/DiscoverySheet.tsx` — the bottom sheet of tiles for the open dimension.
- `components/explore/DiscoveryChips.tsx` — the collapsed active-filter chip bar (may be folded into `DiscoveryControls`).
- `components/explore/HorizonSegment.tsx` — the rehomed Today/Week/Month control.
- `lib/activities.ts` — the Activity registry (section 6.1).
- `lib/tiles.ts` — assembles tile lists (label, key, image, optional live count) for each dimension from `zones`, `occasions`, `activities`.

**Changed**
- `components/explore/ExploreClient.tsx` — new state, new render tree, stacked filtering, pass `pick` to feed, mount `SearchPanel` and `DiscoverySheet`.
- `components/explore/Hero.tsx` — remove pick card; render value-prop band; keep skyline SVG usage identical.
- `components/explore/CascadeFeed.tsx` — accept a `pick` prop, render it as the elevated "Today's pick" (R1) at the top of the lead section; keep everything else.
- `components/ui/Card.tsx` — extend `PickCard` (or add a thin wrapper) to support the R1 folded-ribbon label, sponsor-blind.
- `lib/explore.ts` — add `filterByActivity`; confirm stacked application.
- `ingest/enrich.ts` — extend batch schema to classify `activities` (section 6.2).
- `app/components.css` — new component styles under the `sbd-` convention.
- `Core Project Files/14_SBDaymaker_Build_Deltas.md` — append a newest-first entry recording this rework and any canon amendments (for example, the retirement of Tune, the new Activity dimension).

**Removed from the Explore tree (not deleted from repo unless orphaned)**
- `ControlRow` usage and the Tune button.
- `TuneSheet` usage. If nothing else imports it after this change, mark it orphaned in the delta ledger; do not delete without confirming zero references.

---

## 8. Feature spec: two-zone sticky

Two independent sticky zones, matching the approved mockup:

1. **Header** (`app/(app)/layout.tsx` `BrandHeader`) already pins (`position: sticky; top: 0`). Keep as is. Add the search control inside it (section 9).
2. **`DiscoveryControls`** (doors + chip bar + horizon) pins directly beneath the header. Its sticky offset must equal the rendered header height. Implement with a shared CSS custom property, for example `--sbd-header-h`, set on the app shell and consumed as `top: var(--sbd-header-h)`; do not hardcode a pixel value that can drift from the real header.
3. **The value-prop hero does not pin.** It scrolls up and away as normal content.

Behavior detail: when `DiscoveryControls` is stuck, it sits flush under the header with a hairline bottom rule so it reads as a bar, not floating content. Confirm no z-index collision between header (highest), `DiscoveryControls`, and the sheet/search overlays (which sit above both).

---

## 9. Feature spec: header deterministic search

### 9.1 Interaction
- Collapsed default: a magnifier icon button in the header top-right, across from the wordmark. 40x40 target, `aria-label="Search"`.
- Tap: the page dims behind a scrim and a search field drops in from the top (`SearchPanel`), overlaying the header. Autofocus the field.
- Type: deterministic results appear anchored directly under the field, grouped by type.
- Dismiss: tap the scrim, tap Cancel, press Escape, or scroll the feed. All close the panel and clear the query.

### 9.2 Matching (deterministic, no AI)
`lib/search.ts` and `/api/search` match the query (case-insensitive, trimmed, substring) against three sources, returning grouped results:
- **Events**: `things.title` (published only). Result routes to `/thing/{id}`.
- **Venues**: distinct venue/place names across published things (derive from the same field `cardPlace` uses). Result routes to the feed filtered to that venue, or the venue's next event; confirm the cleanest target in Phase 0.
- **Tags**: the controlled display vocabulary (occasion labels, zone labels, activity labels). Result applies the corresponding filter (sets `vibe`/`place`/`activity`) and closes the panel.

Ordering within each group: exact prefix match first, then substring, then by soonest `starts_at`. Cap each group (for example 5) with a "more" affordance if needed. Empty query shows nothing (or a small hint). Empty results show a plain "No matches for X" line.

### 9.3 Endpoint
`app/api/search/route.ts`: public GET `?q=`, no admin gate, deterministic Supabase `ilike` queries (or in-memory filter over the already-loaded published set if Phase 0 finds that simpler and sufficient at current catalog size). Light rate limiting via a per-session key. No Claude call.

### 9.4 Result tag styling
Group tags are color-coded via tokens: Event = `--pacific`, Venue = `--sage`, Tag = neutral (`--plaster-2` fill, `--ink-2` text). This typing is load-bearing for making a deterministic search feel intelligent; keep it.

---

## 10. Feature spec: value-prop hero (skyline untouched)

Modify `Hero.tsx`:
- **Keep** the skyline SVG render (`/hero/sb-skyline.svg`), the glow/sun/fog atmosphere layers, and the `__sky` date + `ConditionChips`. The gray-day and time-of-day variants stay.
- **Remove** the entire `__pick` block.
- **Add** a value-prop band in the sky zone, above the skyline silhouette, using the locked copy (section 13, Voice 1). Fraunces display for the headline, Inter for the subline, gold mono eyebrow. Text must clear WCAG AA over the sky at all times of day and on gray days; use the existing scrim/text-shadow approach and verify contrast against the darkest and lightest sky variants.
- The `pick` prop is no longer consumed by `Hero`; update the type and the `ExploreClient` call site.

The hero remains non-sticky (section 8).

---

## 11. Feature spec: discovery doors, sheet, chips, stacked filters, horizon rehome

### 11.1 Doors (`DiscoveryDoors`)
Three photographic pills, equal width, in `DiscoveryControls`: Place, Vibe, Activity. Each has a mono kicker ("Explore" / "Set a mood" / "Pick a thing"), a Fraunces label, and a token-tinted scrim over its image (Place = pacific, Vibe = purple, Activity = terracotta). Tapping a door opens `DiscoverySheet` for that dimension. Each door is a real `button` with an accessible name (for example "Filter by place").

### 11.2 Sheet (`DiscoverySheet`)
Bottom sheet, slides up over a scrim (reuse the existing sheet motion/`--shadow-sheet` used by `TuneSheet` so it matches the app). Contents = the tile grid for the open dimension, sourced from `lib/tiles.ts`:
- Place tiles = zones; Vibe tiles = occasions; Activity tiles = activities.
- Each tile is photographic (with the token-color fallback from 6.3), labeled, and shows an optional live count ("28 this week") computed client-side from the current `things` set. Count is optional; ship without it if it complicates Phase 4, add later.
- Tapping a tile sets that dimension's filter, closes the sheet, and collapses the selection into the chip bar. The tile shows a selected state before the sheet closes.
- Sheet is dismissible via scrim, Cancel/close, Escape. Focus trap while open; focus returns to the triggering door on close.

### 11.3 Chip bar (`DiscoveryChips`)
When any dimension is active, a horizontal chip bar appears within `DiscoveryControls` (below the doors, above the horizon segment). One chip per active dimension, token-colored to its dimension, each independently removable (the "x" clears just that dimension). A "Reset" affordance clears all. Chips scroll horizontally if they overflow; no wrap.

### 11.4 Stacked filtering (Approach 2, confirmed)
All active dimensions apply simultaneously (AND). Implement `filterByActivity` in `lib/explore.ts` and compose it with the existing `filterByLens` and `nearMeSort`/`place` (section 4). Preserve current behavior for Place and Vibe.

**Empty-state safety (required, because stacked filters on a thin catalog will return zero).** When the stacked filters produce an empty result:
- Render `CascadeFeed`'s `EmptyState` with copy that names the situation and offers recovery. Provide two actions: "Show the closest matches" (drops the most recently added filter and re-runs) and "Clear filters" (existing reset). If dropping the last filter still yields nothing, keep dropping to the last non-empty state. This prevents the worst first impression (a blank feed) that stacked filtering risks.

### 11.5 Horizon rehome + Tune retirement (`HorizonSegment`)
- Move the Today/Week/Month control out of the old `ControlRow` into `HorizonSegment`, rendered inside `DiscoveryControls` directly beneath the doors/chips, and included in the sticky zone.
- Remove the Tune button and `TuneSheet` from the tree. The lens/zone controls Tune used to expose are now reached through the Place and Vibe doors.
- Preserve the `horizon` state and all `withinHorizon` behavior; only its presentation moves.

---

## 12. Feature spec: Today's pick (R1)

- `CascadeFeed` accepts a `pick: Thing | null` prop and renders it as an elevated card at the top of the lead section (above the Tier 1 list), for the current horizon.
- Visual = R1 (folded corner ribbon): an elevated `PickCard`-style card (image band, save heart, occasion eyebrow, Fraunces title, place + time meta, blurb) with a folded terracotta ribbon in the top-left of the media reading "Today's pick" (a small gold star glyph before the label). Everything below it in the feed stays as compact `ListCard`s, so the contrast does the work.
- Label maps to horizon: today = "Today's pick", week = "This week's pick", month = "This month's pick". Confirm wording with Jim; default to these.
- Exactly one pick per horizon. Sponsor-blind: chosen by the same pinned-pin-then-`ordered[0]` logic the old hero used. The ranker still never reads sponsor status.
- The pick is excluded from the normal list below it (as the old `feed = ordered without hero` did), so it never appears twice.
- Ribbon is decorative; the accessible name of the card is the event title as today.

---

## 13. Copy deck (exact strings)

Use these verbatim. No em-dashes. Plain dollar signs if any appear.

**Value-prop hero (Voice 1)**
- Eyebrow: `Your knowing local friend`
- Headline: `Everything worth doing in Santa Barbara, in one place.`
- Subline: `Scattered across a dozen sites, gathered here and curated by someone who knows the town. Find it, save it, make a plan.`

**Doors**
- Place: kicker `Explore`, label `Place`
- Vibe: kicker `Set a mood`, label `Vibe`
- Activity: kicker `Pick a thing`, label `Activity`

**Sheet titles**
- Place: `Where to?`
- Vibe: `What's the mood?`
- Activity: `What are you after?`

**Search**
- Field placeholder: `Search events, venues, tags...`
- Empty results: `No matches for "{q}".`

**Empty feed (stacked filters)**
- Message: `Nothing matches all of those. Try loosening one.`
- Actions: `Show the closest matches` and `Clear filters`

**Today's pick ribbon**
- `Today's pick` (or the horizon variant per section 12)

---

## 14. Accessibility (WCAG 2.2 AA)

- Search button, door buttons, tiles, chips, chip "x", horizon segment: real buttons/controls, visible `:focus-visible` ring (`--pacific`), 44x44 minimum target.
- Search panel and discovery sheet: focus trap while open; Escape closes; focus returns to the trigger on close; scrim is not a keyboard trap.
- Horizon segment: implement as a radio group or tablist with correct roles and `aria-checked`/`aria-selected`, arrow-key navigation.
- Chips: each chip's remove control has an accessible name, for example "Remove Funk Zone filter".
- Value-prop text: verify contrast over the darkest (night) and lightest (gray/fog) sky variants; keep the scrim/shadow that guarantees AA.
- Reduced motion: sheet slide, cascade/reveal, and any tile transition collapse to instant under `prefers-reduced-motion: reduce`, consistent with the existing 13 reduced-motion blocks.
- Search results and filtered feed updates announce politely (aria-live region for result counts) without being noisy.

---

## 15. Design system and CSS

- All styles under the `sbd-` convention in `app/components.css`. Suggested blocks: `sbd-search`, `sbd-vphero`, `sbd-doors`, `sbd-door`, `sbd-sheet` (reuse existing if present), `sbd-chip`, `sbd-horizon`, `sbd-pick` (extend existing pick styles), `sbd-pick__ribbon`.
- Colors, type, spacing, radius, shadow, motion strictly from tokens. No new hex.
- Reuse the existing sheet motion and shadow (`--shadow-sheet`, the `TuneSheet` slide) so the discovery sheet is visually continuous with the rest of the app.
- Do not introduce a CSS framework or new dependency. Tailwind v4 CSS-first config already in place; match it.

---

## 16. Phased build plan (hard stop-and-show gates)

One phase at a time. After each, stop and show rendered output at both ~390px and ~1280px in a single checkpoint, and wait for Jim's approval before proceeding. Treat all decisions in this spec as settled; do not reopen them. Handle all git and terminal mechanics autonomously; never ask Jim to run commands. DDL is the sole exception: deliver the migration file for Jim to paste into Supabase.

- **Phase 0 — Reconciliation.** Read the live repo. Confirm every file path and behavior in section 3. Confirm the filter composition order, the venue field for search, the header height mechanism, and whether an existing column suits `activities` before adding one. Produce a short findings note listing confirmations and any drift from this spec. **Stop and show.**
- **Phase 1 — Data and taxonomy.** Create `lib/activities.ts`; write `supabase/migrations/15_activities.sql` (do not run it); extend `ingest/enrich.ts` batch schema to classify `activities`; wire the enrich-backfill to populate published rows. Deliver the migration for Jim to apply, then confirm backfill against a dev/sample run. **Stop and show.**
- **Phase 2 — Header search.** `SearchButton`, `SearchPanel`, `lib/search.ts`, `/api/search`. Deterministic, grouped, dismissible, accessible. **Stop and show at both widths.**
- **Phase 3 — Value-prop hero.** Modify `Hero.tsx`: remove pick card, add value-prop band, skyline SVG untouched. Verify contrast across sky variants. **Stop and show.**
- **Phase 4 — Discovery controls.** `DiscoveryControls`, `DiscoveryDoors`, `DiscoverySheet`, `DiscoveryChips`, `HorizonSegment`, `lib/tiles.ts`; add `filterByActivity`; wire stacked filtering and the empty-state safety; retire Tune/`ControlRow`/`TuneSheet` from the tree. **Stop and show at both widths.**
- **Phase 5 — Today's pick.** Extend `PickCard` for the R1 ribbon; pass `pick` into `CascadeFeed`; render at top of lead; exclude from the list below. **Stop and show.**
- **Phase 6 — Sticky integration, a11y, QA.** Wire the two-zone sticky with the header-height variable; full accessibility pass; reduced-motion; cross-width QA; update `14_SBDaymaker_Build_Deltas.md`. **Stop and show, then done.**

---

## 17. QA checklist (before the final gate)

- Skyline SVG file unchanged (diff shows no change to `/hero/sb-skyline.svg`).
- No Claude call reachable from any public handler (search is deterministic).
- Header pins; doors + horizon pin beneath it; value-prop scrolls away. Verified at 390px and 1280px.
- Stacked filters AND correctly; empty-state safety triggers and both recovery actions work.
- Search matches events, venues, tags; routes correctly per type; deterministic ordering.
- Today's pick appears once, is sponsor-blind, respects founder pin, and never double-renders.
- Tune button and sheet gone; no dangling imports; orphans flagged in the delta ledger.
- Full keyboard path through search, doors, sheet, tiles, chips, horizon. Focus visible and restored.
- Reduced-motion collapses all new animations.
- No new hex; no new localStorage keys; no new dependency.
- Migration file present, additive, not executed by Claude Code.

---

## 18. Open decisions to surface to Jim (do not block; flag inline)

1. **Venue search target:** filter the feed to the venue, or jump to the venue's next event? (Phase 2 will propose the cleaner option based on the live data shape.)
2. **Live tile counts:** ship the "28 this week" counts in Phase 4, or add later? Default: add later if it complicates the phase.
3. **Build-your-day CTA:** Jim has questioned its value. Out of scope here, but Phase 6 can note whether the new discovery flow makes it redundant, for a later decision.
4. **Pick label wording** per horizon (section 12): confirm "Today's / This week's / This month's pick".
5. **Activity vocabulary** (section 6.1): confirm and trim the starter list before backfill runs, since changing keys after backfill means re-enriching.

---

## 19. Kickoff prompt (paste this into Claude Code)

> Read `15_SBDaymaker_Home_Rework_Spec.md` in full before doing anything. It is the contract for a home-screen rework of SB Daymaker. Then read `SBDaymaker_Home_Final.html` for the visual intent.
>
> Before writing any code, run Phase 0 exactly as the spec defines it: reconcile every file path and behavior against the live repo, treat live code as truth, and produce a short findings note of confirmations and drift. Do not proceed past Phase 0 until I approve it.
>
> Hard rules, no exceptions: the production skyline asset `/hero/sb-skyline.svg` must remain byte-for-byte identical; no per-request AI (search is deterministic string matching); all DDL is additive and delivered to me as a migration file to paste into Supabase myself, never executed by you; the Trust Rule holds (ranker and search never read sponsor status); WCAG 2.2 AA is the floor; design tokens only, no new hex; the `sbd-` CSS convention; no new localStorage keys; no new dependencies.
>
> Build in the phases the spec defines, one at a time, with a hard stop-and-show after each covering both ~390px and ~1280px. Treat every decision already made in the spec as settled; do not reopen them. Handle all git, branch, and terminal mechanics yourself; never ask me to run commands (the Supabase migration is the only thing I apply by hand). Where anything in the spec conflicts with live code, stop and flag it rather than guessing.
>
> Start with Phase 0 now.
