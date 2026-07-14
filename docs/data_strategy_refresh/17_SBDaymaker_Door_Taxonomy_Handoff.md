# 17 · SB Daymaker — Three-Door Taxonomy (Final) · Handoff for Data Architecture Session

**Date:** 2026-07-12
**Status:** Final taxonomy, founder-approved. Supersedes Doc 16 v1 and the "Vibe" door label in Doc 15 (Home Rework Spec). Place-door composition reflects a founder override (see 3.1 note).
**Purpose of this file:** Give a fresh Claude session full context on the home-screen three-door filtering system so that data source, ingestion, and tagging architecture decisions can be made with this taxonomy as a fixed input.

---

## 1. What this is and what it replaces

SB Daymaker's Explore home screen is being reworked (Doc 15). Part of that rework: the existing **Tune button and ControlRow** (which let users filter on vibe and location) are **retired** and replaced by **three persistent door buttons** near the top of the page, below the hero.

Each door is a large tappable tile. Tapping one opens a **bottom sheet** with a short list of selectable options. Selecting an option filters the feed. The doors sit above the existing **Today / Week / Month** horizon toggle, which is unchanged.

The three doors (kicker text + label):

| Door | Kicker | Label | Sheet prompt |
|---|---|---|---|
| 1 | EXPLORE | **Place** | "Where do you want to be?" |
| 2 | PERFECT FOR | **Occasion** | "What are you up to?" |
| 3 | PICK A THING | **Activity** | "What kind of thing?" |

Door 2 is a **rename** of the previously specced "SET A MOOD / Vibe" door. Sheet mechanics (tile, bottom-sheet reveal, sticky behavior per Doc 15 Option B) are unchanged. Only labels and sheet contents changed.

### The governing principle
**Door sets *what* · Cascade sets *order* · Horizon sets *when*.**
No door option is wired to a happening tier. The three-tier cascade (Tier 1 discrete dated → Tier 2 recurring → Tier 3 evergreen) always sets ordering beneath any door selection. The Today/Week/Month toggle owns time; there is deliberately **no time door**.

---

## 2. Design rules (fixed constraints for any architecture work)

1. **Max 8 rows per sheet, one tap deep.** No nested menus. 44px minimum tap targets (WCAG 2.2 AA floor applies).
2. **Every sheet includes a "Show everything" escape hatch** (clears that door's filter). On two-column tile layouts, it occupies the final cell.
3. **No option may dead-end.** Every row must return a healthy result set. The Coverage heatmap (cockpit) is the standing guardrail: chronically thin cells trigger a restock directive or fold into a neighbor. This is a **direct requirement on ingestion**: source coverage must be able to feed every door option.
4. **Doors read existing data.** Place reads the zone field. Activity reads `happening_category` (query buckets over the existing 16-category vocabulary; no new stored field). Occasion reads `thing_tags` (existing occasion-tag junction: confidence + provenance, AI-proposed, cockpit-approved).
5. **No per-request AI.** All tagging/classification is batch (nightly pipeline). Doors are pure queries at tap time.
6. **Trust rule (load-bearing):** no door, sheet, or ranking ever reads sponsor status. Sponsored placements are labeled and structurally separate.
7. **One sanctioned duplicate:** Family is reachable via Occasion (Family Day) and Activity (Family & Kids). It is the only duplicate permitted; every other option has exactly one home.

---

## 3. The taxonomy

### 3.1 Door 1 — Place (8 options)

Zone-level, not micro-neighborhood. Sparse areas fold into their nearest anchor; the Coverage heatmap decides if a folded zone ever earns its own row.

| # | Option | Sheet sub-copy | Folds in / notes |
|---|---|---|---|
| 1 | Downtown & State Street | The core. Theaters, First Thursday, the promenade. | Eastside · Westside · Milpas corridor (split later if Coverage shows density) |
| 2 | Funk Zone | Tasting rooms, galleries, the walkable block party. | Lower State below the 101 |
| 3 | Waterfront & Harbor | Stearns Wharf, East Beach, the breakwater. | Cabrillo corridor · West Beach |
| 4 | The Mesa | Mesa Lane, Douglas Preserve, Shoreline Park sunsets. | Hendry's · Shoreline |
| 5 | Mission & Riviera | The Mission, the Botanic Garden, the view roads. | Mission Canyon · Upper East |
| 6 | Uptown & Upper State | La Cumbre, Loreto Plaza, the everyday stretch. | San Roque · Five Points |
| 7 | Goleta & Isla Vista | UCSB, Old Town Goleta, the western beaches. | UCSB campus events · IV · Ellwood |
| 8 | Montecito · Summerland · Carpinteria | Coast Village Road to the world's safest beach. | The eastern coastal stretch as one zone |

> **Founder override, on record:** the advisory recommendation was to cut Uptown & Upper State (predicted chronically thin event inventory) and fold it into Downtown & State Street. Jim overrode: Uptown & Upper State stays. **Architecture consequence:** this zone is the most likely thin cell in the system. Ingestion planning should identify sources that can feed it (e.g., La Cumbre Plaza programming, Loreto Plaza venues, San Roque corridor events, neighborhood association calendars), and the Coverage heatmap should watch it from day one.

### 3.2 Door 2 — Occasion (7 static options + 1 weather-conditional)

The renamed Vibe door. Intent-based ("what are you up to?"), never adjective-based. Six of seven static options are **existing** occasion tags on `thing_tags`. One new tag joins the vocabulary (Dog Friendly). A second new tag (Rainy Day) exists in the vocabulary but appears **conditionally**.

| # | Option | Sheet sub-copy | Data mapping |
|---|---|---|---|
| 1 | Date Night | An evening worth dressing up for. | existing tag `date_night` |
| 2 | Family Day | Out with the kids, stroller and all. | existing tag `family_day` · sanctioned duplicate with Activity: Family & Kids · negative rule: 21+ never qualifies |
| 3 | Nightlife / After Dark | Going out tonight. Bars, DJ nights, the late spots. | existing tag `nightlife` |
| 4 | Hosting Visitors | Showing someone the city. The must-see canon. | existing tag `hosting_visitors` |
| 5 | Solo Outing | Out on your own. Easy, no-plans-needed picks. | existing tag `solo` |
| 6 | Free in SB | A great day that costs nothing. | existing tag `free_sb` · negative rule: non-free never qualifies (already enforced) |
| 7 | Dog Friendly | Bring the dog. Beaches, patios, trails. | **NEW tag** `dog_friendly` · negative rule: leash-prohibited venues never qualify |
| — | Rainy Day *(conditional)* | Gray outside, good inside. | **NEW tag** `rainy_day` (maps over the existing Indoor attribute) · negative rule: outdoor-only never qualifies · **appears in the sheet only on gray/rain days** (weather signal already flows via OpenWeather for the hero's context-aware copy; same signal gates this row) |

**Tags migrated out of this door (not deleted):** `catch_a_show`, `arts_culture`, `outdoors_active`, `wine_food` remain in `thing_tags` untouched, but now surface through Door 3 (Activity), not Door 2. Rationale: the original ten-tag Lens mixed occasions and activity categories because it was one control doing two jobs; with three doors, each job has one home.

**Considered and cut:** Groups (weak signal, everything is group-OK), Tourists / Weekend Visitors (Hosting Visitors covers the canon; serving visitors is the whole app), Budget Friendly (Free in SB + the Under $50 refine chip cover it), Romantic / Relaxing / Hidden Gem (adjectives, not occasions; Hidden Gem is an editorial treatment, not a filter).

### 3.3 Door 3 — Activity (7 options)

> **Reconciled to live code (2026-07-12) — see Docs 20 and 21.** The live Activity door shipped with a finer **11-slug controlled vocabulary** in `lib/activities.ts` (`live-music`, `arts-galleries`, `food-drink`, `outdoors`, `markets`, `family-kids`, `clubs-groups`, `film-talks`, `wellness-fitness`, `nightlife`, `festivals-community`), reading `things.activities text[]`, not the 7 buckets over `happening_category` described below. The founder locked the live vocabulary as the source of truth, so this section records the original intent; **Doc 21 §4 is the live mapping.** The 7-option design below is retained for rationale, not as the build target.

Query buckets over the existing 16-value `happening_category` vocabulary. No new stored field; the buckets live in code as category groupings.

| # | Option | Sheet sub-copy | Absorbs |
|---|---|---|---|
| 1 | Live Music & Shows | The Bowl, SOhO, the Lobero, club shows, comedy. | Live Music · Comedy · Theater performances · concert nightlife |
| 2 | Wine & Food | Tasting rooms, the Urban Wine Trail, pop-ups, dinners, happy hours. | Food & Drink · Wine · Beer · happy hour windows · maps 1:1 to existing tag/category territory of `wine_food` |
| 3 | Arts & Culture | Galleries, museums, film, First Thursday, workshops. | Arts · exhibits · film · Classes & Workshops |
| 4 | Outdoors & Active | Hikes, beaches, races, run clubs, a Gauchos game. | Outdoor Rec · Hiking · Wellness · Sports (participatory and spectator, until inventory justifies a split) |
| 5 | Markets & Fairs | Farmers markets, craft fairs, the standing rhythms. | Farmers Markets · Shopping events · flea and makers markets (predominantly Tier-2 recurring content) |
| 6 | Festivals & Community | Fiesta, Solstice, holiday events, the town showing up. | Festivals · Holiday · Charity · Networking · civic events (predominantly Tier-1 dated content) |
| 7 | Family & Kids | The zoo, MOXI, storytimes, kid-sized adventures. | Family · Kids · sanctioned duplicate with Occasion: Family Day |

**Note on the Wine & Food merge:** an earlier draft split Wine & Beer from Food & Drink. That split manufactured a fuzzy boundary the stored data does not have (the existing tag is `wine_food`, one tag) and created classification ambiguity (winemaker dinners, brewery food events). Merged back into one bucket. Fuzzy boundaries between options are the real cause of selection overwhelm, more than option count.

---

## 4. Implications for data source / ingestion architecture

These are the load-bearing consequences the architecture session should design around:

1. **Coverage is now a per-cell obligation.** The taxonomy defines a grid: 8 zones × 7 activity buckets × 7+1 occasion tags, cross-cut by 3 time horizons. Not every cell needs depth, but **every door option in isolation must return a healthy sheet**. Source selection should be evaluated against the door options they feed, not just total volume. The existing Coverage heatmap (vibe/zone dims, 7/14/30/45-day windows) is the measurement instrument; consider whether it needs an activity-bucket dimension.
2. **The predicted thin cells** (design for these first): Uptown & Upper State (all buckets), The Mesa (Tier-1 events), Mission & Riviera (Tier-1 events), Solo Outing (tag application discipline more than sourcing), and Montecito · Summerland · Carpinteria (source coverage today skews SB-city-core).
3. **Two new occasion tags enter the batch pipeline:** `dog_friendly` and `rainy_day`, each with a negative rule (leash-prohibited never `dog_friendly`; outdoor-only never `rainy_day`). AI proposes, cockpit approves, consistent with the existing `thing_tags` confidence + provenance model. **No per-request AI.** If the tag vocabulary is enum-constrained anywhere, that is an additive DDL change Jim applies manually in the Supabase SQL editor.
4. **Rainy Day is weather-gated at render time, not at data time.** Things carry the tag year-round; the door sheet shows the row only on gray/rain days, using the same OpenWeather signal that already drives context-aware hero copy. Ingestion/tagging treats it as a normal tag.
5. **Zone folding is an ingestion-side mapping.** Eastside/Westside/Milpas events must resolve to the Downtown & State Street zone; Lower State to Funk Zone; and so on per the fold-in column in 3.1. Whatever geocoding/neighborhood-assignment step exists in the pipeline needs this 8-zone rollup as its output vocabulary (the finer neighborhood value can be retained underneath for future splits).
6. **Activity buckets are code-level groupings, not schema.** Keep the 16-category `happening_category` vocabulary intact; the door buckets are a mapping table in code. This preserves optionality (e.g., splitting Sports out of Outdoors & Active later) without DDL.
7. **The doors replace Tune/ControlRow, so door filters are the primary filter path.** Any analytics/instrumentation planning should treat door-option taps as a first-class signal: per-option tap counts are the demand-side complement to the Coverage heatmap's supply-side view, and together they are the future personalization substrate (want→been signals per occasion tag).

---

## 5. Standing constraints (unchanged, restated for the new session)

- ~15 min/day solo-operator ceiling; ~$45–95/month platform cost floor
- Batch AI only (nightly GitHub Actions); no per-request Claude calls
- No end-user accounts (localStorage + magic link); no in-app transactions
- WCAG 2.2 AA floor
- Additive-only DDL, applied manually by Jim
- Google Place Photos treated as metered cost (`IMAGE_MONTHLY_CALL_CAP=500`)
- `lib/explore.ts` consumed as-is, never modified
- Code is truth; `CLAUDE.md` is the contract; stale docs are flagged, not followed

*End of handoff. This taxonomy is a fixed input to the data architecture strategy; open questions belong to sourcing, coverage, and pipeline design, not to the door structure itself.*
