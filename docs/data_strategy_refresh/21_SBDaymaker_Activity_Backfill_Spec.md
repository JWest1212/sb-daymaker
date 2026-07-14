# 21 · SB Daymaker — Activity Backfill (Build Spec)

`Status: v1 · 2026-07-12 · build spec. Cites Doc 20 (reconciliation) and Doc 18 §7.2. Fixes a live production gap.`

> **What this builds.** A deterministic, no-AI backfill that populates the empty `things.activities text[]` column from the already-populated `happening_category`, so the live Activity door stops returning near-empty results. Adds the founder-approved `festivals-community` slug to the controlled vocabulary, applies the mapping across the catalog, and folds it into the nightly land step so new things self-tag.
>
> **Why this is urgent.** The audit found **716 of 725 things have no activity tag** (only 9 tagged). The Activity door is live and reading `activities[]`, so right now tapping almost any Activity option returns close to nothing in production. This is the highest-impact quick fix in the current queue.
>
> **Precedence.** The live controlled vocabulary in `lib/activities.ts` is the source of truth (founder decision, 2026-07-12). Doc 17 §3.3 and Doc 18 §7.2 are reconciled to it, not the other way around. `CLAUDE.md` is the contract; code is truth.

---

## 1. The problem

`happening_category` (16 values) is populated on every thing and drives nothing user-facing anymore. `activities text[]` (the new column the Activity door reads) is empty on 99% of things. The door renders all 11 tiles regardless, so most tiles return empty or near-empty counts live. The fix is not new data or AI; it is deriving `activities[]` from the `happening_category` we already have.

Because `activities[]` is a **multi-valued array**, the old single-bucket problem (was this theater a "show" or an "arts" thing) is gone. A thing can carry several activity slugs.

---

## 2. The fix, in one line

Deterministic map `happening_category` to one or more `activities[]` slugs, apply once over the catalog, then run it on every new thing in the nightly land step. No AI, no per-request calls, no cost.

---

## 3. The vocabulary (locked)

Ten slugs exist in `lib/activities.ts`. Add one: **`festivals-community`** (label "Festivals & community"), because `festival_fair` and `community_gathering` have no clean home otherwise and festivals are a signature SB category. `activities[]` is a `text[]` with **no DB enum**, so this is a **code edit to `lib/activities.ts` and the tile registry, not DDL.** Final list of 11:

`live-music` · `arts-galleries` · `food-drink` · `outdoors` · `markets` · `family-kids` · `clubs-groups` · `film-talks` · `wellness-fitness` · `nightlife` · **`festivals-community`** (new)

---

## 4. The mapping (the contract)

`happening_category` → `activities[]`. Multi-valued where a category legitimately spans slugs.

| `happening_category` | `activities[]` |
|---|---|
| `live_music` | `live-music` |
| `recurring_nightlife` | `live-music`, `nightlife` |
| `arts_theater` | `arts-galleries`, `film-talks` |
| `culture_spot` | `arts-galleries` |
| `recurring_arts` | `arts-galleries` |
| `food_drink_event` | `food-drink` |
| `food_drink_spot` | `food-drink` |
| `weekly_special` | `food-drink` |
| `sports_outdoors_event` | `outdoors`, `wellness-fitness` |
| `outdoor_activity` | `outdoors` |
| `recurring_outdoors` | `outdoors`, `wellness-fitness` |
| `scenic_chill` | `outdoors` |
| `recurring_market` | `markets` |
| `shopping_browse` | `markets` |
| `festival_fair` | `festivals-community` |
| `community_gathering` | `festivals-community` |

All 16 categories are covered. The mapping is additive: it fills `activities[]` where empty and does not overwrite the 9 rows already hand/otherwise tagged (union, do not clobber).

---

## 5. Known sparse slugs (honest gap)

Three of the 11 slugs are not reachable from `happening_category` and will stay empty or thin after this pass:

- **`family-kids`** — there is no family category. It fills from the `family_day` occasion tag (a cheap deterministic cross-map) or the later AI pass. **Follow-up, not this spec**, because it needs the occasion tag registry confirmed first (Doc 20 §6).
- **`clubs-groups`** — no clean category maps to it; fills in the later AI/occasion pass.
- **`film-talks`** — only partially filled (via `arts_theater`); a dedicated signal comes later.

This is acceptable: the pass un-empties the high-volume tiles (live music, food & drink, outdoors, arts, markets, festivals) immediately, which is the live gap that matters. The thin tiles improve in the occasion/AI phase.

---

## 6. Phased build (stop and show)

**Phase 1 — Vocabulary.** Add `festivals-community` to `lib/activities.ts` and the tile registry (`lib/tiles.ts`). *Show:* the door now renders 11 tiles.

**Phase 2 — Mapper + dry run.** Build a pure `categoryToActivities(category)` function from §4. Dry-run it over all published things and print the projected per-slug counts. Writes nothing. *Show:* the projected distribution across all 11 slugs (this is the real "how full does each tile get" number).

**Phase 3 — Apply.** Union the mapped slugs into `activities[]` where empty; never clobber the 9 already-tagged rows. *Show:* before/after empty-count (716 → near-zero for mapped categories) and the live per-tile counts.

**Phase 4 — Self-heal.** Call the mapper in the live `ingest/` land step so every new thing gets `activities[]` on arrival. *Show:* the next nightly run tagging new things automatically.

---

## 7. Acceptance checklist

- [ ] `festivals-community` added to `lib/activities.ts` and the tile registry; door renders 11 tiles.
- [ ] `categoryToActivities` is pure, unit-tested, covers all 16 categories per §4.
- [ ] Dry run prints projected per-slug counts over live things; writes nothing.
- [ ] Apply unions into `activities[]` where empty; the 9 pre-tagged rows are untouched (no clobber).
- [ ] Empty-`activities[]` count drops from 716 to only the legitimately-unmapped residue.
- [ ] Live `ingest/` land step calls the mapper for new things.
- [ ] No AI, no per-request calls, no DDL (text[] needs none), no change to `lib/explore.ts`.
- [ ] Never touched dead code: `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.
- [ ] `family-kids` / `clubs-groups` sparsity noted as expected, deferred to the occasion/AI phase.

---

## 8. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then Doc 20 (20_SBDaymaker_LiveCode_Reconciliation_Delta.md), then this spec
(21_SBDaymaker_Activity_Backfill_Spec.md).

Goal: the live Activity door is near-empty because things.activities (text[]) is unset on 716 of
725 things. Fill it deterministically from happening_category. NO AI, NO per-request calls, NO DDL
(activities is text[], no enum). Do the 4 phases in section 6, ONE at a time, stop and show me
after each, wait for my go.

Hard constraints:
- The live vocabulary in lib/activities.ts is the source of truth. 
- activities[] is multi-valued; a thing can carry several slugs.
- Union into activities[] where empty; NEVER clobber the 9 rows already tagged.
- Never touch lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx, NearMeSheet.tsx. Self-heal goes in
  the LIVE ingest/ land step only.
- lib/explore.ts consumed as-is.

Phase 1 now:
1. Add the slug `festivals-community` (label "Festivals & community") to lib/activities.ts and the
   tile registry (lib/tiles.ts). 
Then stop and confirm the door renders 11 tiles before Phase 2 (the mapper + dry run using the
mapping table in section 4).
```

---

*End of Doc 21. Follow-up after this ships: the `family-kids` / `clubs-groups` fill, which is part of the occasion two-pass work and waits on the occasion tag registry (Doc 20 §6).*
