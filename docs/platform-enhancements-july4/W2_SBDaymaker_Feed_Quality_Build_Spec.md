# W2 Build Spec — Make the Feed Feel Curated

`Doc W2 · for Claude Code · run after Wave 1 · written against commit caa7302 + live-DB snapshot + Docs 18/19`

---

## What this is

Three phases that put the founder's editorial judgment into the *selection* layer — ranking, tags, and imagery — where today it lives only in the blurbs. Evidence from the live front page: a "Street Tree Advisory Committee" meeting ranked as a top card under an "Arts" pill; ~179 of 592 things carry zero occasion tags (invisible to the Lens); one Pexels photo repeated six times above the fold.

| Phase | Fix |
|---|---|
| **W2.1** | Editorial weight: consume it in ranking, auto-downweight civic filler, one-tap cockpit nudge |
| **W2.2** | Tag quality: backfill the untagged ~30%, tighten the AI rubric, one new AI-only negative rule |
| **W2.3** | Image variety: category-aware queries + per-batch dedupe + targeted re-resolve of repeat offenders |

**One phase at a time. Stop-and-show after each. Do not start the next until Jim says go.**

## §0 · Ground rules

1. Read `CLAUDE.md` (v10 if the WC session ran) first. Reconcile all file:line references below against the live repo before editing.
2. **No DDL.** `editorial_weight` already exists on `things` (smallint, −5..+5, default 0). If you think you need a migration, stop and flag.
3. **The trust rule is the whole point of this wave being safe.** You are modifying `cascade()` for the first time ever. `editorial_weight` is *founder curation* — explicitly permitted. The ranker must still never read `is_featured` or `sponsor_id`. Add a test asserting those fields are absent from every sort key you touch, and a code comment at the change site restating the rule.
4. **Determinism:** no AI at request time, no randomness. The only AI in this wave is the existing nightly/backfill batch enrich (W2.2), unchanged in topology.
5. All DB writes from the worker/service-role paths only; cockpit writes admin-gated + audit-logged, per the established pattern.
6. Voice, tokens, a11y rules as in the Wave 1 spec §0. Update Doc 14 at wave close.
7. **Out of scope:** the motif SVG library (separate design track), Discover guides, edition, any Wave 4 item. Do not rename feed section labels. Do not touch the Tier-2 day-filter from W1.3 beyond keeping its tests green.

---

## PHASE W2.1 — Editorial weight

### W2.1a — Ranking consumption (`lib/explore.ts`)

Current `cascade()` sorts by `happening_tier` asc, then within Tier-1 by `starts_at` asc, else preserves DB order. Change to this exact deterministic key, per tier:

- **All tiers:** items with `editorial_weight < 0` sink to the **bottom of their tier section** (they remain visible and findable — never hidden).
- **Tier-1, non-negative:** primary `starts_at` asc (soonest-first legibility is preserved); secondary `editorial_weight` desc (same-start ties break toward founder-boosted); tertiary stable input order.
- **Tier-2/3, non-negative:** primary `editorial_weight` desc; secondary existing order (DB/alpha).

Verify `editorial_weight` rides along in `THINGS_SELECT` (`lib/things.ts`) and on the `Thing` type; add it if the select omits it (a select-list change, not DDL).

**Auto-hero upgrade.** Extract a shared pure helper in `lib/explore.ts`:

```ts
export function pickAutoHero(ordered: Thing[], sbTodayKey: string): Thing | null
```

Rule: among Tier-1 items occurring **today** (same `sbDay` key) with `editorial_weight > 0`, pick highest weight, tie → soonest; if none, return `ordered[0] ?? null` (current behavior). Wire it into **both** consumers so they can never diverge: the `ExploreClient` hero memo (pinned pick still wins first, then `pickAutoHero`, then the W1.3b evergreen fallback) and `lib/heroServer.ts`'s projected "Auto" pick for the cockpit hero-plan rail (the header comment there says the projection must use the site's own ranker — honor it by importing this helper, never forking).

**Tests (pure, vitest):** negative sinks within tier but stays present; Tier-1 chronological order preserved among zero-weights; same-start tie breaks by weight; Tier-2 ordering by weight; `pickAutoHero` prefers today's highest positive weight, falls back correctly; a regression test that the sort never reads `is_featured`/`sponsor_id` (e.g., sort a fixture where those fields are set adversarially and assert order is unchanged vs. the same fixture without them).

### W2.1b — Civic-filler classifier (worker) + one-time backfill

New pure function (suggest `ingest/weight.ts`):

```ts
export function classifyWeight(c: { title: string; sourceKey?: string }): number // 0 or -3
```

Returns **−3** when the title matches (case-insensitive, word-boundary): `committee | commission | advisory (board|committee) | board meeting | public hearing | agenda review | city council | task force | study session | subcommittee`. Tune against real drops/titles in the repo's fixtures — check `fixtures/seed_rows.json` and recent `ingest_drops`-style titles for false positives (e.g., "Concert Series Committee Presents…" should NOT match if the phrase is promotional; if that's hard to distinguish, accept the false positive — a founder ▲ fixes it in two seconds, which is the design).

Wire: candidates get `editorial_weight = classifyWeight(...)` before landing; add the field to the `Candidate` contract (`packages/shared/types.ts`) and to `land.ts`'s upsert columns. Landed rows default 0 as today when unmatched.

**Backfill:** a `WEIGHT_BACKFILL=1` branch in `ingest/run.ts` (mirroring the existing backfill patterns + a `workflow_dispatch` boolean input in `ingest.yml`): scan existing `things` with `editorial_weight = 0` and `status IN ('published','needs_review')`, apply `classifyWeight` to titles, update matches to −3, write one `audit_log` row per change (`action:'weight_auto'`, `actor:'rule'`), print a summary count. Data update only — no DDL. Run it once as part of this phase and report the count to Jim (expect it to catch a meaningful slice of the 210 `community_gathering` rows).

**Tests:** classifier true/false cases including the tuned edge cases.

### W2.1c — Cockpit ▲/▼ nudge

- **API:** `POST /api/admin/weight` `{ thing_id, weight }` — admin-gated (`getAdminUser`), clamp to integer −5..+5 (400 otherwise), service-role update, `audit_log` (`action:'weight_set'`, `actor:'founder'`), `revalidatePublic()` (a weight change can change the live hero/order).
- **UI:** a compact `▲ n ▼` control on the Queue's `ReviewCard` and on each `CatalogView` row. Requirements: current value visible; buttons ≥44×44 with `aria-label`s ("Boost {title}" / "Lower {title}"); keyboard operable; optimistic update with revert-on-error toast; disabled at the clamps. Styling via existing cockpit CSS patterns, tokens only. Keep it *small* — this is a two-second gesture, not a form.
- Queue approve flow unchanged: weight edits are metadata-immediate like `hero_eligible` (mirror that route's shape), no re-review required.

### Acceptance (stop-and-show)

- [ ] Fixture-level proof of the new ordering; all new + existing explore tests green.
- [ ] Live check: committee-pattern items now render at the bottom of their section (or show the backfill count if none are in today's view); the front page hero prefers a founder-boosted item when one exists today.
- [ ] Cockpit ▲/▼ works on Queue + Catalog; a boost is visible on `/` within seconds (revalidate path proof); audit rows written.
- [ ] Trust-rule regression test in the suite; `npm run test` + `npx next build` clean; ~390px + ~1280px verified.

---

## PHASE W2.2 — Tag quality

### The three parts

1. **Rubric tightening** (`ingest/enrich.ts` SYSTEM prompt): add explicit tagging guidance with anti-examples — alcohol-primary venues (breweries, taprooms, wine tasting rooms, bars) default to `wine_food` and/or `nightlife`, not `family_day`; civic services and government meetings are not leisure occasions and should receive few or no tags; `family_day` requires genuinely family-oriented programming, not merely "families could technically attend." Keep the prompt in the existing voice/format; do not change model, chunking, timeout, or the tool schema beyond the prompt text.
2. **One new negative rule — AI-proposed tags only** (`applyNegativeRules` in `ingest/enrich.ts`): if the title matches `\b(brewer|brewing|taproom|winery|wine bar|tasting room|distiller|cocktail|pub)\b/i`, strip `family_day` from the AI's proposed tags. **Deliberately scoped:** this runs on AI output only — the founder can still add `family_day` in the cockpit for genuinely family-friendly cases (M Special with its cornhole and food trucks is the canonical example; do not make this a hard publish-time rule like the 21+/free rules in `approve`'s `filterTags`). Comment this rationale at the rule.
3. **Backfill the untagged ~179.** Inspect what `backfillEnrich` (`ingest/run.ts` `ENRICH_BACKFILL` branch) actually targets. If it already covers published things with zero `thing_tags`, run it. If it only targets missing blurbs, extend its selection to `published/needs_review things with zero tag rows` (keep blurb behavior: do not overwrite existing founder-edited blurbs — enrich only what's missing). Then execute one backfill run (`workflow_dispatch`) and report before/after: tagged-things count (baseline 413/592) and tags-per-thing.

**Constraint checks:** batch-only (the backfill is a worker run); the enrich payload still omits start times (do not touch `buildItems`); audit rows still written per draft.

### Acceptance (stop-and-show)

- [ ] Prompt diff shown; negative-rule unit tests (brewery loses AI `family_day`; founder-sourced tags untouched — test `tag_source` paths if reachable, else assert the rule sits inside the AI-only function).
- [ ] Backfill executed: report old→new tag coverage numbers and 10 sample items with their new tags for Jim's spot-check.
- [ ] Lens smoke test on `/`: each of the 10 occasion tags returns a non-absurd set; `family_day` no longer dominated by taprooms.
- [ ] Tests + build clean.

---

## PHASE W2.3 — Image variety (bridge until the motif library)

### The three parts

1. **Category-aware queries.** Find where the image query (`photo_query` / `q`) is built for a candidate (trace from `ingest/images.ts` — likely title/neighborhood based). Add `happening_category`-keyed query templates so a `community_gathering` doesn't get the same generic search as `live_music` — e.g., library/kids programming → "children library craft", farmers markets → "farmers market produce stall california", live music → "live band small venue stage", civic → prefer the branded placeholder over a misleading stock photo (a deliberate choice: for civic-meeting items, skip Pexels and go straight to placeholder — a neutral card beats a fake one). Keep templates in one exported map with a comment that the motif library will supersede most of this.
2. **Per-batch URL dedupe.** In `resolveImages`, track `photo_url`s already assigned in this run (and optionally seed the set with the most-used existing URLs from a cheap `image_cache` scan); when `pexelsMany(q, 3)` returns options, prefer the first not-yet-used URL; only repeat when every option is used. Cache writes unchanged.
3. **Targeted re-resolve of repeat offenders.** A `REPEAT_BACKFILL=1` branch (+ workflow input): query live `things` for `photo_url`s shared by **>3** published things, re-run those things through the resolver with `force:true` (the existing `backfillImages` force path) and the new variety logic. Free-tier only — confirm the Google gate/cap code path is untouched and report `image_spend` before/after (must be unchanged unless Google was legitimately reached under the cap).

**Tests:** query-template selection per category; batch-dedupe preference logic (pure — factor the "pick first unused option" into a testable function).

### Acceptance (stop-and-show)

- [ ] Re-resolve executed: report the offender URLs found, things re-resolved, and new distinct-photo count; screenshot the live front page showing no photo URL repeated more than twice above the fold.
- [ ] Civic items now carry the branded placeholder (or a sensible neutral), not random stock.
- [ ] `image_spend` unchanged (or within-cap Google usage explicitly reported); waterfall order and cap logic untouched (existing image tests green).
- [ ] Tests + build clean; Doc 14 entries for all three phases appended.

*End of Doc W2.*
