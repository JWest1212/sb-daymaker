// Gate 4 · A4.5, meal-insertion tests.

import { describe, it, expect } from "vitest";
import { thing } from "./_fixture";
import { insertMeals, isFood, mealBlock } from "./meals";
import { buildConciergeDay } from "./buildConciergeDay";
import { resolveParams } from "./params";
import type { PlanAnswers, Stop } from "./types";
import type { SbNow } from "@/lib/format/openNow";

const NOW: SbNow = { dow: 6, minute: 14 * 60 };
const noop = () => null;

const foodDowntown = thing({ id: "food-dt", happening_category: "food_drink_spot", nearby_zone: "downtown", price_band: "$$" });
const foodFunk = thing({ id: "food-funk", happening_category: "food_drink_spot", nearby_zone: "funk", price_band: "$" });
const foodSplurge = thing({ id: "food-lux", happening_category: "food_drink_spot", nearby_zone: "downtown", price_band: "$$$" });
const foodBar = thing({ id: "food-bar", happening_category: "food_drink_spot", nearby_zone: "downtown", is_21_plus: true });
const activity = thing({ id: "act", happening_category: "arts_theater", nearby_zone: "downtown", tags: ["arts_culture"] });

describe("isFood / mealBlock", () => {
  it("recognizes food by category, activity, and tag", () => {
    expect(isFood(foodDowntown)).toBe(true);
    expect(isFood(thing({ activities: ["food-drink"] }))).toBe(true);
    expect(isFood(thing({ tags: ["wine_food"] }))).toBe(true);
    expect(isFood(activity)).toBe(false);
  });
  it("maps lunch to the afternoon block when active", () => {
    expect(mealBlock("lunch", ["morning", "afternoon"])).toBe("afternoon");
    expect(mealBlock("lunch", ["morning"])).toBe("morning");
    expect(mealBlock("dinner", ["afternoon"])).toBeNull();
  });
});

describe("insertMeals", () => {
  it("seats a lunch stop in-cluster and in-budget", () => {
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "friends", vibes: [], zone: "downtown", meals: ["lunch"], budget: "mid" } as PlanAnswers);
    const activityStops: Stop[] = [{ id: "a", block: "afternoon", thingId: "act", fromSaved: false, fromDraft: true }];
    const { mealStops } = insertMeals({ activityStops, params, pool: [activity, foodDowntown, foodSplurge], savedStateFor: noop, now: NOW });
    expect(mealStops).toHaveLength(1);
    expect(mealStops[0].meal).toBe("lunch");
    expect(mealStops[0].thingId).toBe("food-dt"); // in-budget $$ preferred over $$$
  });
  it("adds nothing for a no-meals plan", () => {
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "friends", vibes: [], zone: "downtown", meals: [] } as PlanAnswers);
    const { mealStops } = insertMeals({ activityStops: [], params, pool: [foodDowntown], savedStateFor: noop, now: NOW });
    expect(mealStops).toHaveLength(0);
  });
  it("does not seat a 21+ food spot on a family plan (honest note instead)", () => {
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "family", kidBand: "young", vibes: [], zone: "downtown", meals: ["lunch"] } as PlanAnswers);
    const { mealStops, notes } = insertMeals({ activityStops: [], params, pool: [foodBar], savedStateFor: noop, now: NOW });
    expect(mealStops).toHaveLength(0);
    expect(notes.some((n) => n.kind === "meal_unfilled")).toBe(true);
  });
  it("counts an already-placed food stop as covering the meal", () => {
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "friends", vibes: [], zone: "funk", meals: ["lunch"] } as PlanAnswers);
    const activityStops: Stop[] = [{ id: "f", block: "afternoon", thingId: "food-funk", fromSaved: false, fromDraft: true }];
    const { mealStops } = insertMeals({ activityStops, params, pool: [foodFunk, foodDowntown], savedStateFor: noop, now: NOW });
    expect(mealStops).toHaveLength(0); // lunch already covered
  });
});

describe("buildConciergeDay · meals end-to-end", () => {
  it("a long plan with lunch contains a lunch stop, flagged as a meal", () => {
    // Enough arts activities that food is not consumed as block filler, so the
    // meal-insertion path actually seats a distinct, meal-flagged lunch.
    const acts = Array.from({ length: 5 }, (_, i) =>
      thing({ id: `arts${i}`, nearby_zone: "downtown", happening_category: "arts_theater", tags: ["arts_culture"] }),
    );
    const res = buildConciergeDay(
      { dateISO: "2026-07-04", periods: ["morning", "afternoon", "night"], who: "friends", vibes: ["arts_culture"], zone: "downtown", meals: ["lunch"] },
      [...acts, foodDowntown], noop, { now: NOW },
    );
    const mealStops = res.stops.filter((s) => s.meal === "lunch");
    expect(mealStops.length).toBeGreaterThanOrEqual(1);
    expect(mealStops[0].thingId).toBe("food-dt");
    // The lunch stop sits in the afternoon block.
    expect(mealStops[0].block).toBe("afternoon");
  });
});
