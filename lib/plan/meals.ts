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
import { noteKeys } from "./notes";
import type { Zone } from "@/lib/zones";

const FOOD_CATEGORIES = new Set(["food_drink_spot", "food_drink_event"]);

/**
 * R1 Wave 3 (W3.1). Things that are tagged food but are not somewhere you eat a
 * meal. A food bank is the audit's case: "Food Distribution | Westside
 * Neighborhood Center" carries happening_category "food_drink_event" and the
 * activity "food-drink", so it satisfied the lunch check, seated itself as the
 * single stop of a couple's afternoon, and in doing so SUPPRESSED both honest
 * "we could not find lunch" notes (TP-A9-04). Sending a couple on a date to a
 * food bank is the worst single output the audit found.
 */
const NOT_A_MEAL = [
  /\bfood\s+distribution\b/i,
  /\bfood\s+bank\b/i,
  /\bfood\s+pantry\b/i,
  /\bpantry\b/i,
  /\bmeal\s+service\b/i,
  /\bmeal\s+delivery\b/i,
  /\bsoup\s+kitchen\b/i,
  /\bfree\s+(?:meals?|lunch|groceries|grocery)\b/i,
  /\bcommunity\s+fridge\b/i,
];

/** Free food-ish events that ARE somewhere you would choose to eat or drink. */
const FREE_FOOD_ALLOWLIST = [
  /\bfarmers?\s*'?\s*market\b/i,
  /\bmarket\b/i,
  /\btasting\b/i,
  /\bpop[-\s]?up\b/i,
  /\bfood\s+truck\b/i,
  /\bhappy\s+hour\b/i,
];

/** Sources that publish programming, not restaurants. A library's cooking class
 *  is a class; it is not where you take someone to lunch. */
function isLibrarySource(t: Thing): boolean {
  return /library/i.test(t.source ?? "");
}

/**
 * A thing that reads as a place to eat or drink (a meal candidate).
 *
 * R1 W3.1 narrowed this. It used to accept any row carrying a food category, the
 * "food-drink" activity, or the wine_food tag, with no exclusions at all.
 */
export function isFood(t: Thing): boolean {
  // A municipal meeting is never lunch, whatever else it carries.
  if (t.is_civic) return false;
  if (NOT_A_MEAL.some((re) => re.test(t.title))) return false;
  if (isLibrarySource(t)) return false;

  const isFoodish =
    (t.happening_category != null && FOOD_CATEGORIES.has(t.happening_category)) ||
    (t.activities as string[]).includes("food-drink") ||
    (t.tags as string[]).includes("wine_food");
  if (!isFoodish) return false;

  // A free food EVENT is usually a giveaway or a community service rather than a
  // meal out. Markets, tastings and pop-ups are the real exceptions, so they are
  // named rather than inferred. Free PLACES are unaffected: a free-to-enter cafe
  // is still a cafe.
  const isFree = t.free === true || t.price_band === "free";
  if (isFree && t.happening_category === "food_drink_event") {
    return FREE_FOOD_ALLOWLIST.some((re) => re.test(t.title));
  }
  return true;
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
      // R1 W3.2. Keyed by the meal, so validate.ts's generic version of the same
      // problem collapses into this more informative one instead of doubling it.
      notes.push({
        kind: "meal_unfilled",
        key: noteKeys.meal(meal),
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
