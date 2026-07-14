# 22 · SB Daymaker — Door Reconciliation (Build Spec + Final Door Taxonomy)

`Status: v1 · 2026-07-12 · build spec. Brings the three live doors to the founder-locked composition. Current-truth reference for door contents; supersedes the taxonomy tables in Doc 17.`

> **What this is.** The single source of truth for what sits behind the three doors, plus the build to make the live site match it. After the audit, the live doors were found mid-migration: Place had 6 zones (target 8), the middle door still showed the transitional 10 occasions labeled "Vibe" (target 8, labeled "Occasion"), and Activity was reconciled separately. This doc locks all three and specifies the changes.
>
> **Founder decisions locked (2026-07-12):** Place builds up to 8 zones; Occasion finishes the migration to 8 and renames from Vibe; Activity lands at 10 via Option A (Clubs & Groups merges into Community & Festivals; Nightlife is retained as a sanctioned second cross-door dual alongside Family).
>
> **Precedence.** This doc is the current-truth door composition. Doc 17 keeps the design rationale; where its tables differ, this doc wins. Activity's build lives in Doc 21 (updated to match). `CLAUDE.md` is the contract; code is truth; `lib/explore.ts` untouched.

---

## 1. The final locked taxonomy (all three doors)

### Place (8 zones) — label / zone slug
1. Downtown & State Street / `downtown`
2. Funk Zone / `funk`
3. Waterfront & Harbor / `waterfront`
4. The Mesa / `mesa`
5. Mission & Riviera / `mission_riviera` **(new)**
6. Uptown & Upper State / `uptown` **(new)**
7. Goleta & Isla Vista / `goleta`
8. Montecito · Summerland · Carpinteria / `montecito`

### Occasion (7 static + 1 conditional) — label / tag slug · door label becomes "Occasion"
1. Date Night / `date_night`
2. Family Day / `family_day`
3. Nightlife / After Dark / `nightlife`
4. Hosting Visitors / `hosting_visitors`
5. Solo Outing / `solo`
6. Free in SB / `free_sb`
7. Dog Friendly / `dog_friendly` **(new tag)**
8. Rainy Day / `rainy_day` **(conditional, weather-gated; enum value already exists)**

### Activity (10) — label / activity slug · build in Doc 21
1. Live Music / `live-music`
2. Arts & Galleries / `arts-galleries`
3. Food & Drink / `food-drink`
4. Outdoors / `outdoors`
5. Markets / `markets`
6. Family & Kids / `family-kids`
7. Film & Talks / `film-talks`
8. Wellness & Fitness / `wellness-fitness`
9. Nightlife / `nightlife`
10. Community & Festivals / `community-festivals` **(replaces `festivals-community` and absorbs the retired `clubs-groups`)**

---

## 2. Per-door change list (live to target)

### 2.1 Place — add 2 zones, relabel 4

Live `ZONES` in `lib/zones.ts` has 6: funk, downtown, waterfront, montecito, mesa, goleta. The door renders via `placeTiles()` in `lib/tiles.ts`.

- **Add** two zones: `mission_riviera` (label "Mission & Riviera") and `uptown` (label "Uptown & Upper State"), each with a tile image at `/tiles/place/{slug}.jpg`.
- **Relabel** to match: `downtown` → "Downtown & State Street", `waterfront` → "Waterfront & Harbor", `montecito` → "Montecito · Summerland · Carpinteria", `goleta` → "Goleta & Isla Vista".
- **Data path (confirm first, then pick the additive route):** the door needs things to resolve to the 8 zones. Preferred: the Place door reads an **8-zone code mapping over the existing `neighborhood` field** (Doc 18 §7.1), so `mission_canyon`/`riviera` → `mission_riviera` and `upper_state` → `uptown`, with **no DDL**. Fallback (only if the door is hard-wired to the `nearby_zone` enum): add the two values to `nearby_zone` (additive DDL, Jim applies) and backfill via the neighborhood sweep. Claude Code confirms which is wired in Phase 0 and takes the no-DDL path if possible.
- **No dead-end risk.** Place is a **sort, not a filter** in the live code, so the two new zones can ship even while thin; they will fill as the neighborhood sweep (Doc 19) resolves the residue. Place-8 and Doc 19 are the same workstream.

### 2.2 Occasion — remove 4, add 2, rename the door

Live `OCCASIONS` in `lib/occasions.ts` has 10: date_night, family_day, nightlife, catch_a_show, arts_culture, outdoors_active, wine_food, free_sb, hosting_visitors, solo. The door renders via `vibeTiles()` in `lib/tiles.ts` and is labeled "Vibe".

- **Remove from the door vocabulary** (not from the enum, not from `thing_tags` data): `catch_a_show`, `arts_culture`, `outdoors_active`, `wine_food`. These four are now served by the Activity door; they stay as retained data per Doc 17, just no longer shown in this door.
- **Rename the door** label from "Vibe" to "Occasion" (kicker "PERFECT FOR", prompt "What are you up to?"). Legacy internal names (`filterByLens`, `LensSheet.tsx`) are not user-facing; leave the dead `LensSheet.tsx` alone.
- **Add two options, staged to avoid dead-ends** (rule: no option may dead-end):
  - `rainy_day` — enum value already exists. Derive it deterministically from `indoor = true` (minus outdoor-only). Can ship as soon as that derivation runs. Conditional render: shown only on gray/rain days via the existing OpenWeather signal.
  - `dog_friendly` — **net-new tag**, needs the venue-attribute registry (Doc 19's `venues` table + founder curation of dog-friendly venues). Add this tile **only after** that tagging populates it, or it dead-ends.
- **Sequencing:** the removals + rename ship immediately (safe, those tags carry data). `rainy_day` follows its derivation. `dog_friendly` follows the venue registry. Do not add either tile before its data exists.

### 2.3 Activity — add Community & Festivals, retire Clubs & Groups (build in Doc 21)

Live `activities` vocabulary in `lib/activities.ts` has 10, including `clubs-groups` and no community/festivals option. Per the locked Option A:

- **Add** `community-festivals` (label "Community & Festivals").
- **Remove** `clubs-groups` from the vocabulary; its content (clubs, groups, meetups, civic) is absorbed by Community & Festivals.
- Net stays at 10. This replaces the `festivals-community` slug that Doc 21 originally introduced. **Doc 21 is updated to build this final set;** its `happening_category` → `activities[]` mapping already routes `festival_fair` and `community_gathering` to this bucket.

---

## 3. Dependencies (what each door needs to be fully populated)

| Door change | Ships when | Depends on |
|---|---|---|
| Place: +2 zones, relabel | now (sort, no dead-end) | data accuracy from Doc 19 sweep |
| Occasion: remove 4 + rename | now | nothing |
| Occasion: +Rainy Day | soon | `indoor` derivation (cheap) |
| Occasion: +Dog Friendly | after venue registry | Doc 19 `venues` table + founder curation |
| Activity: +Community & Festivals, −Clubs & Groups | with Doc 21 backfill | Doc 21 |

---

## 4. Files touched

- `lib/zones.ts` — add 2 zones, relabel 4.
- `lib/tiles.ts` — `placeTiles()` (8 zones), `vibeTiles()` (8 occasions), `activityTiles()` (10, via Doc 21).
- `lib/occasions.ts` — the door vocabulary drops the 4 migrated tags; add `dog_friendly`, `rainy_day` when their data is ready.
- `lib/activities.ts` — final 10 (Doc 21).
- Door label component (`DiscoveryDoors.tsx` / `DiscoveryControls.tsx`) — "Vibe" → "Occasion".
- Tile images under `/tiles/place/` for `mission_riviera`, `uptown`; `/tiles/vibe/` for `dog_friendly`, `rainy_day`; `/tiles/activity/` for `community-festivals`.
- **Never touch** `lib/explore.ts`, `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.

---

## 5. Schema changes (additive, Jim applies by hand)

- Add `dog_friendly` to the `occasion_tag` enum. (`rainy_day` already exists; confirm it is in `occasion_tag` and do not re-add.)
- Place zones: **no DDL** on the preferred code-mapping path. Only if the fallback is required, add `mission_riviera` and `uptown` to `nearby_zone`.
- Activity: **no DDL** (`activities` is `text[]`).

---

## 6. Phased build (stop and show)

**Phase 0 — Confirm wiring (read-only).** Report exactly what field the Place door filters/counts on, and how `vibeTiles`/`activityTiles` compute counts. Confirm `rainy_day`'s enum. *Show:* the findings and which Place data path (code-mapping vs enum) will be used.

**Phase 1 — Occasion migration (safe, now).** Remove the 4 migrated tags from the door vocabulary; rename the door "Vibe" → "Occasion". *Show:* the Occasion sheet rendering 6 options (the safe static set minus Dog Friendly/Rainy Day, which come later) and the renamed door.

**Phase 2 — Place to 8.** Add `mission_riviera` and `uptown`, relabel the 4, wire the 8-zone data path (no DDL preferred). *Show:* the Place sheet rendering 8 zones with live per-zone counts.

**Phase 3 — Activity to final 10.** Per Doc 21: add `community-festivals`, remove `clubs-groups`. *Show:* the Activity sheet rendering the final 10.

**Phase 4 — Rainy Day.** Derive `rainy_day` from `indoor`; add the conditional tile with weather-gating. *Show:* the tile appearing only on gray/rain days with a populated sheet.

**Phase 5 — Dog Friendly (after venue registry).** Once the `venues` registry carries dog-friendly venues, stamp `dog_friendly` and add the tile. *Show:* a populated Dog Friendly sheet. (Gated on Doc 19; may come later.)

---

## 7. Acceptance checklist

- [ ] Place sheet shows 8 zones with correct labels; counts populate (thin new zones acceptable, Place is a sort).
- [ ] No new `nearby_zone` DDL unless the fallback path was required and flagged.
- [ ] Occasion door renders the migrated set; the 4 moved tags no longer appear in it but remain in `thing_tags` data.
- [ ] Door label reads "Occasion" everywhere user-facing.
- [ ] Rainy Day derives from `indoor`, renders only on gray/rain days, sheet is populated.
- [ ] Dog Friendly tile is added only after the venue registry populates it (no dead-end).
- [ ] Activity renders the final 10; `clubs-groups` retired, `community-festivals` present (Doc 21).
- [ ] `dog_friendly` added to `occasion_tag` by Jim; `rainy_day` not re-added.
- [ ] Never touched `lib/explore.ts`, `lib/pipeline.ts`, `lib/enrich.ts`, `LensSheet.tsx`, `NearMeSheet.tsx`.

---

## 8. Claude Code kickoff prompt (paste-ready)

```
Read CLAUDE.md, then Doc 22 (22_SBDaymaker_Door_Reconciliation_Spec.md), then Doc 20 and Doc 21.

Bring the three live doors to the locked taxonomy in Doc 22 section 1. Do the phases in section 6,
ONE at a time, stop and show me after each, wait for my go.

Hard constraints:
- lib/explore.ts consumed as-is. Never touch lib/pipeline.ts, lib/enrich.ts, LensSheet.tsx,
  NearMeSheet.tsx.
- No option may dead-end: do NOT add the Dog Friendly or Rainy Day tiles until their data exists
  (Rainy Day after the indoor-derivation in Phase 4; Dog Friendly after the venue registry, Phase 5).
- Place is a SORT not a filter; the 2 new zones may ship thin.
- Prefer the no-DDL path for Place zones (code mapping over neighborhood, Doc 18 §7.1). Only fall back
  to extending the nearby_zone enum if the door is hard-wired to it, and if so, tell me the exact DDL
  to run; I apply all DDL by hand.
- The only additive DDL expected is adding dog_friendly to the occasion_tag enum (Phase 5). Tell me
  the SQL; I run it.

Phase 0 first (read-only): confirm what field the Place door filters/counts on, how vibeTiles and
activityTiles compute counts, and which enum rainy_day lives in. Report and stop before Phase 1.
```

---

*End of Doc 22. This is the current-truth door taxonomy; Doc 17's tables are historical rationale. Occasion's Dog Friendly and Rainy Day tagging connects to the two-pass work in Doc 18, still pending the occasion tag registry confirmation (Doc 20 §6).*
