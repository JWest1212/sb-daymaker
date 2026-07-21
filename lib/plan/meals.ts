// Gate 4 · G4.5, meal logic. A plan without lunch isn't a plan. If the day spans
// a mealtime the user asked for, ensure a food stop occupies it, matching budget
// band and cluster. If the ranked spine didn't already seat food there, insert
// the best eligible food thing. Never leave a long plan mealless; if no eligible
// food exists nearby, surface an honest note instead of shipping a broken plan.
// Pure, deterministic, no AI. No em dash (Golden Rule).

import type { Thing } from "@/lib/things";
import type { Block, Meal, PlanNote, ResolvedParams, Stop } from "./types";
import { hardFilter, withinBudgetBand } from "./hardFilter";
import { rankCandidates } from "./rankCandidates";
import { anchorZoneFor } from "./cluster";
import type { Zone } from "@/lib/zones";

const FOOD_CATEGORIES = new Set(["food_drink_spot", "food_drink_event"]);

/** A thing that reads as a place to eat/drink (a meal candidate). */
export function isFood(t: Thing): boolean {
  if (t.happening_category && FOOD_CATEGORIES.has(t.happening_category)) return true;
  if ((t.activities as string[]).includes("food-drink")) return true;
  if ((t.tags as string[]).includes("wine_food")) return true;
  return false;
}

/** Which block seats which meal in the 3-block model. Lunch prefers the afternoon
 *  block (the midday bridge), falling back to morning when only morning is active. */
function mealBlock(meal: Meal, periods: Block[]): Block | null {
  switch (meal) {
    case "breakfast":
      return periods.includes("morning") ? "morning" : null;
    case "lunch":
      if (periods.includes("afternoon")) return "afternoon";
      if (periods.includes("morning")) return "morning";
      return null;
    case "dinner":
      return periods.includes("night") ? "night" : null;
  }
}

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

const MEAL_NOUN: Record<Meal, string> = {
  breakfast: "breakfast",
  lunch: "lunch",
  dinner: "dinner",
};

export interface InsertMealsInput {
  activityStops: Stop[];
  params: ResolvedParams;
  pool: Thing[];
  savedStateFor: (id: string) => "want" | "been" | null;
  now?: Parameters<typeof hardFilter>[1]["now"];
}

export interface InsertMealsResult {
  mealStops: Stop[];
  notes: PlanNote[];
}

/**
 * Produce the meal stops to add to a set of activity stops. For each requested
 * meal whose block is active: if a food stop is already placed there, it counts;
 * otherwise seat the best eligible in-cluster, in-budget food thing. Emits an
 * honest note for any meal that cannot be filled.
 */
export function insertMeals(input: InsertMealsInput): InsertMealsResult {
  const { activityStops, params, pool, savedStateFor, now } = input;
  const mealStops: Stop[] = [];
  const notes: PlanNote[] = [];

  const thingById = new Map(pool.map((t) => [t.id, t]));
  const placed = new Set<string>(activityStops.map((s) => s.thingId));
  const placedThings = activityStops
    .map((s) => thingById.get(s.thingId))
    .filter((t): t is Thing => Boolean(t));
  const anchorZone: Zone | null = anchorZoneFor(params, placedThings);

  for (const meal of params.meals) {
    const block = mealBlock(meal, params.periods);
    if (!block) continue; // the mealtime's block isn't in the plan; nothing to seat

    // Already have food in this block? Then the meal is covered.
    const blockThings = [...activityStops, ...mealStops]
      .filter((s) => s.block === block)
      .map((s) => thingById.get(s.thingId))
      .filter((t): t is Thing => Boolean(t));
    if (blockThings.some(isFood)) continue;

    // Find the best eligible food thing for this block/cluster/budget.
    const eligible = hardFilter(pool, { params, block, anchorZone, now })
      .filter((t) => isFood(t) && !placed.has(t.id));

    // Prefer strictly in-budget (no splurge) food, but fall back to eligible if a
    // strict match is unavailable (better a slight stretch than a mealless day).
    const strict = eligible.filter((t) => withinBudgetBand(t, params.budget));
    const searchPool = strict.length > 0 ? strict : eligible;

    const ranked = rankCandidates(block, params, searchPool, savedStateFor, placed);
    const pick = ranked[0];
    if (!pick) {
      notes.push({
        kind: "meal_unfilled",
        text: `We couldn't find an open ${MEAL_NOUN[meal]} spot in your area and budget. Add one you like, or widen the plan.`,
      });
      continue;
    }

    placed.add(pick.thing.id);
    mealStops.push({
      id: genId(),
      block,
      thingId: pick.thing.id,
      fromSaved: pick.savedState !== null,
      fromDraft: true,
      meal,
    });
  }

  return { mealStops, notes };
}

export { mealBlock };
