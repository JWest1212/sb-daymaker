// Gate 4 · The Concierge Day. Upgrades buildDraft from a picker into a constraint
// solver while staying pure and deterministic (no per-request AI, CLAUDE.md §2.3).
// Pipeline: resolve params -> hard-constraint filter -> geo-clustered slot
// assignment -> meal insertion -> validation. Returns an editable draft spine
// plus honest notes. Extends the Plan engine; it does not replace it. No em dash.

import type { Thing } from "@/lib/things";
import { areaForThing, AREA_BY_KEY, type AreaKey } from "@/lib/areas";
import type { PlanAnswers, PlanNote, Stop, ResolvedParams, Block } from "./types";
import { resolveParams } from "./params";
import { hardFilter, withinBudgetBand } from "./hardFilter";
import { rankCandidates, type RankedThing } from "./rankCandidates";
import { clusterBoost, anchorZoneFor } from "./cluster";
import { insertMeals } from "./meals";
import { validatePlan } from "./validate";
import { reduceNotes, emptyBlockText, noteKeys } from "./notes";
import type { SbNow } from "@/lib/format/openNow";

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Soft category boost applied only when the user selected no vibes (mirrors the
// original buildDraft priors so a no-vibe day still leans sensible per block).
const DEFAULT_PRIOR: Record<Block, string[]> = {
  morning:   ["outdoors_active", "food_drink_spot"],
  afternoon: ["arts_culture", "shopping_browse", "food_drink_spot"],
  night:     ["wine_food", "catch_a_show", "nightlife"],
};

/** Choose the best candidate for a block: preserve rankCandidates' saved-first
 *  ordering, but bias within-band by geographic cohesion (clusterBoost) and a mild
 *  in-budget preference, so the day stays tight and on-budget. */
function chooseBest(
  ranked: RankedThing[],
  anchorZone: AreaKey | null,
  params: ResolvedParams,
): RankedThing | undefined {
  if (ranked.length === 0) return undefined;
  return [...ranked].sort((a, b) => {
    const sav = (b.savedState ? 1 : 0) - (a.savedState ? 1 : 0);
    if (sav !== 0) return sav;
    const adj = (r: RankedThing) =>
      r.score +
      clusterBoost(r.thing, anchorZone, params) +
      (withinBudgetBand(r.thing, params.budget) ? 1 : 0);
    return adj(b) - adj(a);
  })[0];
}

export interface ConciergeResult {
  stops: Stop[];
  notes: PlanNote[];
  params: ResolvedParams;
}

export interface BuildConciergeOptions {
  /** Thing ids to exclude (used by Regenerate to skip current stops). */
  alreadyPlaced?: Set<string>;
  /** Injected "now" for deterministic tests. Defaults to real SB time. */
  now?: SbNow;
}

/**
 * Build a validated, editable draft day. One (or two, if pace=packed) activity
 * stops per active period, geo-clustered, with meals seated per the meal logic.
 */
export function buildConciergeDay(
  answers: PlanAnswers,
  pool: Thing[],
  savedStateFor: (id: string) => "want" | "been" | null,
  options: BuildConciergeOptions = {},
): ConciergeResult {
  const params = resolveParams(answers);
  const { alreadyPlaced = new Set<string>(), now } = options;

  const placed = new Set<string>(alreadyPlaced);
  const placedThings: Thing[] = [];
  const perBlock: Record<Block, Stop[]> = { morning: [], afternoon: [], night: [] };
  const notes: PlanNote[] = [];

  const stopsPerBlock = params.pace === "packed" ? 2 : 1;

  for (const block of params.periods) {
    // When no vibes selected, inject DEFAULT_PRIOR as a soft boost (tag-matching).
    const perBlockAnswers: PlanAnswers =
      params.vibes.length === 0
        ? { ...answers, vibes: DEFAULT_PRIOR[block] as PlanAnswers["vibes"] }
        : answers;

    for (let n = 0; n < stopsPerBlock; n++) {
      const anchorZone = anchorZoneFor(params, placedThings);
      const eligible = hardFilter(pool, { params, block, anchorZone, now });
      const ranked = rankCandidates(block, perBlockAnswers, eligible, savedStateFor, placed);
      const pick = chooseBest(ranked, anchorZone, params);
      if (!pick) break; // thin inventory for this block; its add-slot will show

      placed.add(pick.thing.id);
      placedThings.push(pick.thing);
      perBlock[block].push({
        id: genId(),
        block,
        thingId: pick.thing.id,
        fromSaved: pick.savedState !== null,
        fromDraft: true,
      });
    }

    if (perBlock[block].length === 0 && params.periods.includes(block)) {
      // Only note a truly empty active block if inventory couldn't fill it at all.
      // (Silent on packed 2nd-stop misses.)
    }
  }

  const activityStops: Stop[] = params.periods.flatMap((b) => perBlock[b]);

  // Meals: seat any requested meal whose block is active and lacks food.
  const mealResult = insertMeals({ activityStops, params, pool, savedStateFor, now });
  notes.push(...mealResult.notes);

  // Order: block by selected order; within a block, meal stops anchor the mealtime
  // first, then activities (matches the prototype: lunch before the afternoon stop).
  const stops: Stop[] = params.periods.flatMap((block) => {
    const meals = mealResult.mealStops.filter((s) => s.block === block);
    const acts = perBlock[block];
    return [...meals, ...acts];
  });

  // R1 W3.3. When the visitor named an area, at most ONE area-less stop may ride
  // along. 38% of rows have no nearby_zone, so without a cap a "Funk AreaKey" day
  // could fill entirely with things whose area nobody knows, which honors the
  // request in name only. Known-area matches already outrank them in the ranker;
  // this bounds what is left.
  const MAX_UNKNOWN_AREA_STOPS = 1;
  let droppedForUnknownArea = 0;
  if (params.zone) {
    const byId = new Map(pool.map((t) => [t.id, t]));
    let unknownSeen = 0;
    const kept: Stop[] = [];
    for (const st of stops) {
      const t = byId.get(st.thingId);
      if (t && !areaForThing(t)) {
        unknownSeen++;
        if (unknownSeen > MAX_UNKNOWN_AREA_STOPS) { droppedForUnknownArea++; continue; }
      }
      kept.push(st);
    }
    stops.length = 0;
    stops.push(...kept);
  }

  // R1 W3.3. Say so when the day could not be filled from the chosen area. The
  // visitor asked for one place; reaching outside it is a reasonable thing to do
  // and an unreasonable thing to do silently.
  if (params.zone) {
    const byId = new Map(pool.map((t) => [t.id, t]));
    const outside = stops.some((st) => {
      const t = byId.get(st.thingId);
      if (!t) return false;
      const a = areaForThing(t);
      return a != null && a !== params.zone;
    });
    if (outside) {
      notes.push({
        kind: "widened",
        key: noteKeys.widened,
        text: `We widened beyond ${AREA_BY_KEY[params.zone].label} to fill the day.`,
      });
    }
  }

  // Honest empty-block note when an active period got nothing at all. R1 W3.2:
  // the slot itself still renders (see PlanResults), so the shape of the day
  // reads even where a period could not be filled.
  const emptyBlocks: Block[] = [];
  for (const block of params.periods) {
    const any = stops.some((s) => s.block === block);
    if (!any) {
      emptyBlocks.push(block);
      notes.push({ kind: "empty_block", key: noteKeys.block(block), text: emptyBlockText(block) });
    }
  }

  // Final validation (auto-notes; UI can offer swap/repair). Does not mutate.
  const thingMap = new Map(pool.map((t) => [t.id, t]));
  const validation = validatePlan(stops, thingMap, params, now);
  notes.push(...validation.notes);

  // R1 W3.2. One reducer decides what the draft says about itself, so two
  // modules can never contradict each other about the same gap, and a day too
  // thin to be a day always says so.
  const reduced = reduceNotes(notes, {
    stopCount: stops.length,
    meals: params.meals,
    emptyBlocks,
  });

  return { stops, notes: reduced, params };
}

/**
 * Gate 4 · G4.4, the next-best eligible alternate for a stop (the tap-to-swap
 * target). Re-runs the hard filter for the block so a swap can never introduce a
 * hard-constraint violation. Returns null when nothing else qualifies. Pure.
 */
export function nextBestAlternate(
  answers: PlanAnswers,
  block: Block,
  pool: Thing[],
  savedStateFor: (id: string) => "want" | "been" | null,
  excludeIds: Set<string>,
  options: BuildConciergeOptions = {},
): Thing | null {
  const params = resolveParams(answers);
  const anchorZone = anchorZoneFor(params, pool.filter((t) => excludeIds.has(t.id)));
  const eligible = hardFilter(pool, { params, block, anchorZone, now: options.now });
  const perBlockAnswers: PlanAnswers =
    params.vibes.length === 0
      ? { ...answers, vibes: DEFAULT_PRIOR[block] as PlanAnswers["vibes"] }
      : answers;
  const ranked = rankCandidates(block, perBlockAnswers, eligible, savedStateFor, excludeIds);
  const pick = chooseBest(ranked, anchorZone, params);
  return pick ? pick.thing : null;
}
