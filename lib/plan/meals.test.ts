// Gate 4 · A4.5, meal-insertion tests.

import { describe, it, expect } from "vitest";
import { thing } from "./_fixture";
import { insertMeals, isFood, mealBlock } from "./meals";
import { buildConciergeDay } from "./buildConciergeDay";
import { resolveParams } from "./params";
import type { PlanAnswers, Stop } from "./types";
import type { Thing } from "@/lib/things";
import type { SbNow } from "@/lib/format/openNow";

const NOW: SbNow = { dow: 6, minute: 14 * 60 };
const noop = () => null;

const foodDowntown = thing({ id: "food-dt", happening_category: "food_drink_spot", neighborhood: "downtown", price_band: "$$" });
const foodFunk = thing({ id: "food-funk", happening_category: "food_drink_spot", neighborhood: "funk_zone", price_band: "$" });
const foodSplurge = thing({ id: "food-lux", happening_category: "food_drink_spot", neighborhood: "downtown", price_band: "$$$" });
const foodBar = thing({ id: "food-bar", happening_category: "food_drink_spot", neighborhood: "downtown", is_21_plus: true });
const activity = thing({ id: "act", happening_category: "arts_theater", neighborhood: "downtown", tags: ["arts_culture"] });

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
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "friends", vibes: [], zone: "downtown_state", meals: ["lunch"], budget: "mid" } as PlanAnswers);
    const activityStops: Stop[] = [{ id: "a", block: "afternoon", thingId: "act", fromSaved: false, fromDraft: true }];
    const { mealStops } = insertMeals({ activityStops, params, pool: [activity, foodDowntown, foodSplurge], savedStateFor: noop, now: NOW });
    expect(mealStops).toHaveLength(1);
    expect(mealStops[0].meal).toBe("lunch");
    expect(mealStops[0].thingId).toBe("food-dt"); // in-budget $$ preferred over $$$
  });
  it("adds nothing for a no-meals plan", () => {
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "friends", vibes: [], zone: "downtown_state", meals: [] } as PlanAnswers);
    const { mealStops } = insertMeals({ activityStops: [], params, pool: [foodDowntown], savedStateFor: noop, now: NOW });
    expect(mealStops).toHaveLength(0);
  });
  it("does not seat a 21+ food spot on a family plan (honest note instead)", () => {
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "family", kidBand: "young", vibes: [], zone: "downtown_state", meals: ["lunch"] } as PlanAnswers);
    const { mealStops, notes } = insertMeals({ activityStops: [], params, pool: [foodBar], savedStateFor: noop, now: NOW });
    expect(mealStops).toHaveLength(0);
    expect(notes.some((n) => n.kind === "meal_unfilled")).toBe(true);
  });
  it("counts an already-placed food stop as covering the meal", () => {
    const params = resolveParams({ dateISO: "2026-07-04", periods: ["afternoon"], who: "friends", vibes: [], zone: "funk_zone", meals: ["lunch"] } as PlanAnswers);
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
      thing({ id: `arts${i}`, neighborhood: "downtown", happening_category: "arts_theater", tags: ["arts_culture"] }),
    );
    const res = buildConciergeDay(
      { dateISO: "2026-07-04", periods: ["morning", "afternoon", "night"], who: "friends", vibes: ["arts_culture"], zone: "downtown_state", meals: ["lunch"] },
      [...acts, foodDowntown], noop, { now: NOW },
    );
    const mealStops = res.stops.filter((s) => s.meal === "lunch");
    expect(mealStops.length).toBeGreaterThanOrEqual(1);
    expect(mealStops[0].thingId).toBe("food-dt");
    // The lunch stop sits in the afternoon block.
    expect(mealStops[0].block).toBe("afternoon");
  });
});

describe("isFood exclusions (R1 W3.1)", () => {
  const food = (over: Partial<Thing> = {}) =>
    thing({ happening_category: "food_drink_event", activities: ["food-drink"], ...over });

  it("rejects a food bank, the audit's single worst plan output", () => {
    // TP-A9-04: this row seated itself as the only stop of a couple's afternoon
    // AND suppressed both "we couldn't find lunch" notes.
    expect(isFood(food({ title: "Food Distribution | Westside Neighborhood Center", free: true }))).toBe(false);
    expect(isFood(food({ title: "Food Distribution | Franklin Neighborhood Center", free: true }))).toBe(false);
  });

  it("rejects the other giveaway shapes", () => {
    for (const title of ["Food Bank Drive", "Community Food Pantry", "Meal Service at the Center", "Soup Kitchen Volunteers", "Free Groceries Friday"]) {
      expect(isFood(food({ title, free: true })), title).toBe(false);
    }
  });

  it("rejects a civic row whatever it carries", () => {
    expect(isFood(food({ title: "Wine Tasting", is_civic: true }))).toBe(false);
  });

  it("rejects library programming, which is a class and not a restaurant", () => {
    expect(isFood(food({
      title: "Healthy Flavors: Celebrating Latin Heritage Through Nutritious Cooking",
      source: "https://calendar.library.santabarbaraca.gov/event/123",
    }))).toBe(false);
    // The audit's other named case: a bookmobile stop that passed isFood().
    expect(isFood(food({ title: "LOTG | Samarkand", source: "https://calendar.library.santabarbaraca.gov/e/1" }))).toBe(false);
  });

  it("rejects a free food event that is not a market, tasting or pop-up", () => {
    expect(isFood(food({ title: "Community Potluck Giveaway", free: true }))).toBe(false);
  });

  it("keeps the free food events people actually choose", () => {
    for (const title of ["Downtown Farmers Market", "Free Wine Tasting at Carr", "Taco Pop-up at the Brewery", "Food Truck Friday", "Happy Hour on the Patio"]) {
      expect(isFood(food({ title, free: true })), title).toBe(true);
    }
  });

  it("keeps ordinary restaurants and food spots", () => {
    expect(isFood(thing({ title: "The Lark", happening_category: "food_drink_spot" }))).toBe(true);
    expect(isFood(thing({ title: "Helena Avenue Bakery", activities: ["food-drink"] }))).toBe(true);
    // A free-to-enter PLACE is still a place to eat; only free EVENTS are suspect.
    expect(isFood(thing({ title: "Santa Barbara Public Market", happening_category: "food_drink_spot", free: true }))).toBe(true);
  });

  it("rejects anything with no food signal at all", () => {
    expect(isFood(thing({ title: "Sunset Kayak Tour", happening_category: "sports_outdoors_event" }))).toBe(false);
  });
});
