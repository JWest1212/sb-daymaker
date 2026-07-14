# 18 · SB Daymaker — Findability & Tagging Architecture

`Status: v1 · 2026-07-12 · reference doc. Pairs with Doc 17 (Three-Door Taxonomy) the way 16b pairs with 16.`

> **What this file is.** The reference architecture for how every "thing" gets tagged so it is correctly findable through the three doors (Place, Occasion, Activity) and all their sub-choices. It turns the Doc 17 taxonomy into a build contract: the mapping tables, the tagging passes, the publish gate, and the three founder decisions that govern them. Build specs cite this doc; this doc does not itself build anything.
>
> **Precedence.** Doc 17 owns the door structure and is a fixed input. This doc owns how data feeds the doors. Where this doc and Doc 16 (Data Sourcing Strategy) touch the same machinery (confidence, coverage, sources), this doc is the narrower and newer authority for the tagging and findability portion. Code is truth; `CLAUDE.md` is the contract; stale docs are flagged, not followed.

> **RECONCILIATION BANNER (2026-07-12) — read Doc 20 first.** A read-only audit of the live code (after the doors shipped) found this doc was written against assumptions that diverged from reality. **Doc 20 (Live-Code Reconciliation Delta) corrects this doc and is authoritative wherever they conflict.** The load-bearing corrections: Place is a **sort, not a filter** (so §4's zone check flags for triage, it never holds); §7.2's Activity mapping is **superseded** because Activity reads `activities text[]`, not `happening_category`; and §8's DDL is reduced because `rainy_day` already exists as an enum value. Inline notes below mark each. Do not build the superseded parts from this doc; use Doc 20.

---

## 1. The reframe: findability is the objective

Until now the pipeline optimized for "do we have the event, and is the record clean." The three doors raise the bar. Every published thing must be correctly **findable** through three separate reading mechanisms. Clean data that lands in the wrong bucket is invisible in the filter that should surface it.

The two failures that matter:

- **False negative** — a thing is missing from a filter it belongs in. Cost: the "if it's happening, we have it" promise breaks inside that filter.
- **False positive** — a thing shows up in a filter it does not belong in. Cost: trust. This is the worse of the two for a "knowing local friend."

One structural relief: every door sheet includes a "Show everything" escape hatch (Doc 17 §2.2), so a thing is never truly lost, the doors are filters over the feed, not the only path to it. That means the real target is **precise inclusion and exclusion per option**, not "get every thing into at least one door." A thing that legitimately has no occasion is correctly absent from Occasion; that is not a gap.

---

## 2. Three doors, three mechanisms, three failure modes

| Door | Reads | Cardinality | Populated by | Hardest failure |
|---|---|---|---|---|
| **Place** | a zone (code mapping over `neighborhood`) | one per thing | deterministic (Pass 1) | things stuck in `other`/null go invisible |
| **Activity** | a bucket (code mapping over `happening_category`) | one per thing | deterministic (Pass 1) | a mis-set category lands the thing in the wrong bucket |
| **Occasion** | `thing_tags` | many per thing | rules (Pass 1) + AI (Pass 2) | under-tagging (false negative) and over-tagging (false positive) |

Occasion is the weakest link. It is multi-valued, ~30% of the live catalog carries no occasion tag today, and it is where both failure modes live at once. The two deterministic doors are near-solved at the data level; the work there is accuracy and completeness of a single field, not invention.

---

## 3. Resolutions to the three taxonomy gaps

Doc 17 has three holes. Each is resolved here so build specs do not have to rediscover them.

### 3.1 Gap A — the "zone field" does not have 8 zones
`nearby_zone` carries only 6 values (funk, downtown, waterfront, montecito, mesa, goleta). The doors need 8. **Resolution:** Place reads an 8-zone **code mapping over the existing `neighborhood` enum (11 values)**, mirroring how Activity maps over `happening_category`. No DDL. `nearby_zone` is left untouched for Near Me and the guides. Granular `neighborhood` is retained underneath for future zone splits (Doc 17 §4.5). The mapping is in §7.1.

The load-bearing consequence: any thing with `neighborhood = 'other'` or null is Place-invisible. Resolving that residue is the neighborhood-accuracy sweep (build spec 1), and it is a prerequisite for the backfill.

### 3.2 Gap B — Family & Kids has no category
Door 3's rule is "Activity reads `happening_category`," but there is no family category in the 16-value vocabulary (the zoo is `culture_spot`, storytime is `community_gathering`). **Resolution:** Family & Kids is **tag-driven**, reading the `family_day` tag, and is named as the second sanctioned exception to the Activity rule (Family is already the one sanctioned duplicate in Doc 17 §2.7). This makes the mechanism honest and needs no DDL. Consequence: the zoo, MOXI, and storytimes must actually receive the `family_day` tag in Pass 2, which they will.

### 3.3 Gap C — Occasion coverage is treated as solved and is not
The doc reads occasion tags as a working mechanism, but only ~70% of things are tagged and coverage is uneven. **Resolution:** the two-pass model (§4) plus a full backfill (§6, decision 3) closes the gap, and occasion-tag completeness becomes a tracked coverage metric (§9). Two smaller items folded in here:

- **Max-8 tension on rainy days.** Occasion shows 7 static options + Rainy Day + "Show everything" = 9 cells when it rains, over the max-8 rule (Doc 17 §2.1). Flag for the door build: on rainy days, either the escape hatch shares the Rainy Day row's context or the sheet allows a ninth cell. This is a UI-layer decision, noted here so it is not lost; it does not affect tagging.
- **Solo needs a crisp definition.** `solo` is the vaguest tag (nearly everything is solo-able), so it will either run thin or become meaningless. Pass 2 must tag it on a positive signal ("good specifically for going alone": counter seating, drop-in, low social-pressure), not on the absence of a group signal. It is on the post-backfill audit list.

---

## 4. The two-pass tagging model

Every thing runs two tagging passes in the nightly batch, then a findability gate before it can publish. No per-request AI; all of this is batch (`ingest/enrich.ts` and its neighbors).

### Pass 1 — Rules (deterministic, free, no review)
Everything the data already knows, stamped in code with `tag_source = 'rule'`. Highest trust, zero cost.

- **Zone** — from the venue dictionary, then address, then neighborhood rollup (§7.1).
- **Activity bucket** — from `happening_category` (§7.2).
- **Free in SB** — from `price_band = 'free'` (already enforced; the `free` column is generated).
- **Rainy Day** — from `indoor = true`, minus outdoor-only (materialized as a tag so the door reads tags uniformly; §8).
- **Dog Friendly** — from the founder-curated venue list (§6, decision 2).
- **Exclusion rules** — the hard negatives, applied in code, never delegated to the model (§5).

### Pass 2 — AI judgment (Haiku batch, pennies, auto-applies)
The "what's it good for" tags that need reading between the lines. `tag_source = 'ai'`, each with a stored `confidence` (the `thing_tags.confidence` column already exists).

- `date_night`, `nightlife`, `hosting_visitors`, `solo`, `family_day`.

Per decision 1 (§6), Pass 2 leans toward tagging when unsure, so sheets stay full. The precision guardrail in §5 is what keeps that safe.

### The findability gate (publish control)

> **Corrected by Doc 20.** Place is a **sort, not a filter** in the live code: a missing zone degrades the sort position and the on-card location label, it does not hide the thing. So a missing zone must **flag for triage, never hold.** Item 2 below also changes: Activity reads `activities text[]`, not `happening_category` (§7.2 superseded).

Before a thing publishes, the gate checks it is findable and flags, it does not block on zone:

1. Has a real door-zone (not `other`/null). If not → **flag for the neighborhood triage queue; publish anyway** (Place is a sort; a missing zone only degrades sort and label).
2. Has its Activity value(s) set (see §7.2, pending live vocabulary via Doc 20).
3. Carries the occasion tags it qualifies for (from Pass 1 + Pass 2).

Confident publishes itself; low-confidence in a way that matters routes to review. Nothing is held on zone alone. This is the same confidence gate proposed in Doc 16, made findability-aware but non-blocking on Place.

---

## 5. The completeness guardrail (decision 1, made safe)

You chose completeness: when unsure, tag it. That is defensible against the "no option may dead-end" rule, but completeness plus the full backfill (decision 3) means the largest batch of speculative tags lands at once, at launch, the highest trust-risk moment. The guardrail is: **completeness at the tagging layer, precision at the read layer.**

1. **Hard negative rules always win.** Stamped in code, they beat any AI guess. 21+ never `family_day`; non-free never `free_sb`; leash-prohibited never `dog_friendly`; outdoor-only never `rainy_day`. (The first two already live in `applyNegativeRules`; the two new ones extend it.)
2. **A low confidence floor keeps true noise out.** "Tag it when unsure" means "when plausible," not "when barely possible." Pass 2 drops proposals below a floor (start near 0.4) so genuine noise is never stored.
3. **The door reads at or above a display floor.** Precision at display is a **read-time filter, not a re-sort.** The door surfaces tags at or above a confidence floor; below it, the tag is stored (for future personalization and audit) but not surfaced. **Important:** ordering inside any sheet stays the cascade (tier then time) per the Doc 17 governing principle, and `lib/explore.ts` is consumed as-is, never modified. Confidence gates what appears; it does not reorder what appears. (This corrects the "confidence orders each sheet" phrasing in visual 18b: the mechanism is a floor filter, not a live reorder, because the cascade owns order.)
4. **One-tap cockpit claw-back.** A "doesn't belong here" control removes a wrong tag and records it, so systematic errors are cheap to correct.
5. **One-time post-backfill spot audit.** ~30 minutes on the vaguest, highest-volume tags (Solo, Date Night) after the backfill run, before launch, to catch systematic over-tagging. One-time, not daily.

Net: sheets stay full, obvious picks are surfaced, true noise never lands, and wrong inclusions are cheap to claw back.

---

## 6. The three locked decisions

| # | Question | Decision | What it means to build |
|---|---|---|---|
| 1 | AI unsure on an occasion tag | **Tag it (completeness)** | Pass 2 leans generous, guarded by §5 (floor + hard rules + claw-back + audit) |
| 2 | How Dog Friendly is assigned | **Venue list first, AI expands later** | A founder-curated venue-attribute registry (see below); Pass 1 stamps from it; AI proposes additions to your queue |
| 3 | How far to backfill before the doors ship | **Full backfill, launch-clean** | Deterministic pass + `ENRICH_BACKFILL` pass over all things; prerequisite is the neighborhood sweep |

**On decision 2 — the venue-attribute registry.** Dog-friendliness is a venue property, not an event property, and is almost never in event text, so a list is the right instrument. It is bigger than one tag: it is the first brick of a reusable venue-attribute registry that later carries accessibility, patio, and parking difficulty, and it feeds the venue-intelligence moat in Doc 16. Founder-curated, high-trust, AI proposes additions for approval. Build it small; it compounds.

**On decision 3 — why full backfill still fits 15 minutes.** It only works because decision 1 auto-applies uncertain tags instead of queuing them. The deterministic pass (zones, `free_sb`, `rainy_day`, exclusions) needs zero review. The AI judgment pass runs over the catalog via the existing `ENRICH_BACKFILL` path (Haiku, pennies) and auto-applies. Your only human time is the one spot audit. The true first task inside the backfill is the neighborhood-accuracy sweep, because zones cannot backfill cleanly while things sit in `other`/null.

---

## 7. The mapping tables (load-bearing reference)

These three tables are the contract. They live in code as mapping tables, not schema.

### 7.1 Place — `neighborhood` (11) to 8 door-zones

| Door zone | `neighborhood` values that map to it |
|---|---|
| Downtown & State Street | `downtown` (Eastside / Westside / Milpas resolve here via the sweep) |
| Funk Zone | `funk_zone` |
| Waterfront & Harbor | `waterfront` |
| The Mesa | `mesa` |
| Mission & Riviera | `mission_canyon`, `riviera` |
| Uptown & Upper State | `upper_state` |
| Goleta & Isla Vista | `goleta` (UCSB / IV / Ellwood resolve here via the sweep) |
| Montecito · Summerland · Carpinteria | `montecito`, `carpinteria` (Summerland resolves here via the sweep) |
| — (no door) | `other` / null → triage; never surfaced in Place until resolved |

Ten of eleven neighborhood values map cleanly; `other`/null is the only gap and is the sweep's job. Sub-neighborhoods that are not distinct enum values (Eastside, IV, Summerland, and so on) are resolved by the venue dictionary and address matching during the sweep, then carried under the correct parent.

### 7.2 Activity — `happening_category` (16) to `activities[]` (11 slugs)

> **Reconciled (2026-07-12). Build authority is Doc 21.** The live Activity door reads `things.activities text[]`, an **11-slug controlled vocabulary in `lib/activities.ts`** (the founder-approved source of truth), not `happening_category`. `activities[]` is **multi-valued**, so the old single-bucket tradeoff is void: a thing can sit in several Activity buckets. `activities[]` is populated **deterministically from `happening_category`** (no AI) per the mapping in **Doc 21 §4**. The 11 slugs: `live-music`, `arts-galleries`, `food-drink`, `outdoors`, `markets`, `family-kids`, `clubs-groups`, `film-talks`, `wellness-fitness`, `nightlife`, `festivals-community` (the last added by founder decision so festivals have a home). Family & Kids (Gap B, §3.2) is now just the `family-kids` slug; it fills from the `family_day` occasion tag or the AI pass, since no `happening_category` maps to it. The original 7-bucket table that stood here is retired; Doc 21 §4 is the live mapping.

### 7.3 Occasion — tags to door options

| Occasion door | Tag | Pass | Note |
|---|---|---|---|
| Date Night | `date_night` | 2 (AI) | on the audit list |
| Family Day | `family_day` | 2 (AI) | 21+ exclusion; sanctioned duplicate with Activity |
| Nightlife / After Dark | `nightlife` | 2 (AI) | |
| Hosting Visitors | `hosting_visitors` | 2 (AI) | |
| Solo Outing | `solo` | 2 (AI) | positive-signal definition; on the audit list |
| Free in SB | `free_sb` | 1 (rule) | from `price_band` |
| Dog Friendly | `dog_friendly` (net-new; absent in live code) | 1 (rule) | from venue registry |
| Rainy Day (conditional) | `rainy_day` (enum value already exists, orphaned) | 1 (rule) | from `indoor`; wire the derivation, no DDL (Doc 20) |

**Migrated-out tags.** `catch_a_show`, `arts_culture`, `outdoors_active`, `wine_food` remain in the enum and on existing things (additive-only, never removed) but are **no longer read by any door**, their function moved to Activity buckets. Pass 2 should stop proposing them to avoid wasted tagging. They are retained as data, retired from the UI.

---

## 8. New tags and additive DDL

> **Corrected by Doc 20.** Only **one** new tag value is needed. `rainy_day` **already exists** as an enum value (orphaned from the earlier Living Postcard work, nothing produces or reads it), so no DDL is required for it, only wiring the derivation. Confirm which enum it lives in and whether that is the same enum the middle door reads (data point in Doc 20 §6). Also note the live tag registry is a **10-value** set read as `tags[]`; confirm the exact values before writing Pass 2.

One additive schema change, applied manually by Jim in the Supabase SQL editor:

- Add `dog_friendly` to the tag enum. (`rainy_day` already exists; do not re-add.)

Separately, the audit flagged a **governance gap**: `activities text[]` has no enum or allowlist behind it (Doc 20 §5, decision 2). Everything else is code: the zone mapping, the venue dictionary/registry, the negative rules, and the read-time confidence floors. `thing_tags.confidence` and `thing_tags.tag_source` already exist, so provenance and confidence need no schema work.

**On `rainy_day` as a materialized tag.** It is a deterministic derivation of `indoor = true` (minus outdoor-only), stored as a tag so the door reads `thing_tags` uniformly and the weather-gating stays a pure render-time condition on an existing OpenWeather signal. Audit `indoor` accuracy across the catalog during the backfill, since it defaults to false and `rainy_day` inherits any error in it.

---

## 9. Impact on Doc 16

Four concrete updates to the data strategy, all reinforcing its spine:

1. **The confidence gate becomes findability-aware.** It gains the three §4 checks (real zone, bucket, qualifying tags) and reads tag-level confidence, not just record-level validity. A thing that is invisible to a door it belongs in does not auto-publish.
2. **The Coverage heatmap gains a dimension.** It currently tracks vibe and zone; add the **activity bucket**. The grid to watch is 8 zones x 7 activity buckets x 8 occasion tags x 3 horizons, and it becomes the standing findability SLA instrument.
3. **A venue-attribute registry becomes a new small component.** Seeded by Dog Friendly (decision 2), reused for accessibility / patio / parking, feeding venue intelligence.
4. **Source prioritization scores partly by door-cell coverage.** A source's value is partly which thin door-cells it feeds, not just raw volume. Discovery points at the thin cells.

---

## 10. What stays the same

None of this touches the load-bearing constraints. Restated so the build specs inherit them:

- **Trust rule holds.** Confidence and tags are quality signals, never sponsor signals. No door, sheet, or ranker reads sponsor status.
- **Batch AI only.** All tagging is nightly; the doors are pure queries at tap time. No per-request AI.
- **`lib/explore.ts` is consumed as-is.** Ordering inside every sheet stays the cascade. Confidence gates what appears, never how it is ordered.
- **No end-user accounts; no in-app transactions.**
- **Additive-only DDL**, applied manually by Jim (here: two enum values).
- **~15 min/day and the cost floor hold.** The deterministic pass is free; the AI passes are pennies; the human cost is the one-time audit plus small daily review.

---

## 11. Predicted thin cells to watch (design for these first)

From Doc 17 §4.2, plus this doc's read:

- **Uptown & Upper State** (all buckets) — the founder override; the most likely thin cell in the system. Watch from day one; source La Cumbre, Loreto Plaza, San Roque corridor.
- **The Mesa** and **Mission & Riviera** — thin on Tier-1 dated events specifically.
- **Montecito · Summerland · Carpinteria** — today's source coverage skews to the SB city core.
- **Solo Outing** — a tagging-discipline problem more than a sourcing one; the positive-signal definition in §3.3 is the fix.

---

## 12. Open items and deferred

- **`arts_theater` venue split** (§7.2) — validate against live data before locking.
- **Rainy-day max-8 cell count** (§3.3) — a door-UI decision, flagged for that build.
- **`indoor` accuracy audit** (§8) — fold into the backfill.
- **Door-tap analytics** (Doc 17 §4.7) — the demand-side signal depends on Vercel Analytics being toggled on, currently mounted but inert. Prerequisite for the personalization substrate; not required for the doors to work.
- **Unifying `nearby_zone` to 8 zones** — deliberately deferred. Place uses a code mapping now; unifying Near Me and the guides onto 8 zones is a later, optional cleanup, not a launch dependency.

---

## 13. Build sequence

This doc is the reference. The builds it governs, in order:

1. **Neighborhood sweep + venue dictionary** (build spec 1) — resolves `other`/null so zones can backfill; produces the venue dictionary that also seeds the venue-attribute registry. Zones gate everything else.
2. **Full backfill** (build spec 2) — deterministic pass (zones, `free_sb`, `rainy_day`, exclusions) then the AI judgment pass over the whole catalog, launch-clean, ending in the one-time spot audit.
3. Door read layer, coverage-heatmap dimension, and the venue-registry surface follow, each as its own mockup-first delta spec.

`CLAUDE.md` gets a small update only when the doors and the two new tags actually ship, so the contract describes what is real.

*End of Doc 18. Reference only; each build gets its own mockup-first delta spec that cites this file.*
