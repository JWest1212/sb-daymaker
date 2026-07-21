// Gate 4 · G4.1, resolve raw PlanAnswers into a fully-defaulted ResolvedParams.
// One place for every default so the hard filter, meal logic, clustering and
// validation all agree, and so the shareable `params` snapshot is stable.
// Pure, no I/O, no AI.

import type { PlanAnswers, ResolvedParams, Meal, Block } from "./types";

/** Default meals when the user didn't pick: seat the meals the selected periods
 *  imply (never breakfast unless morning is selected; lunch when the day spans
 *  midday; dinner when night is selected). */
function inferMeals(periods: Block[]): Meal[] {
  const set = new Set<Meal>();
  const has = (b: Block) => periods.includes(b);
  if (has("morning")) set.add("breakfast");
  // Lunch whenever the day touches the midday bridge (morning or afternoon).
  if (has("morning") || has("afternoon")) set.add("lunch");
  if (has("night")) set.add("dinner");
  // Preserve a canonical order.
  return (["breakfast", "lunch", "dinner"] as Meal[]).filter((m) => set.has(m));
}

export function resolveParams(answers: PlanAnswers): ResolvedParams {
  const who = answers.who;
  const kidBand = who === "family" ? (answers.kidBand ?? null) : null;
  // Toddlers force a slow pace (nap windows, no late night); otherwise honor the
  // chosen pace, defaulting to slow (a calmer day reads better than an over-packed one).
  const pace = kidBand === "toddler" ? "slow" : (answers.pace ?? "slow");
  const meals =
    answers.meals !== undefined ? answers.meals : inferMeals(answers.periods);

  return {
    dateISO: answers.dateISO,
    periods: answers.periods,
    who,
    kidBand,
    vibes: answers.vibes,
    zone: answers.zone,
    transport: answers.transport ?? "car",
    budget: answers.budget ?? null,
    meals,
    pace,
  };
}

// ---- Human labels for the params chip row (shared view + OG) ----------------

const WHO_LABEL: Record<PlanAnswers["who"], string> = {
  solo: "Solo",
  couple: "Couple",
  family: "Family",
  friends: "Friends",
};

const KID_LABEL: Record<NonNullable<PlanAnswers["kidBand"]>, string> = {
  toddler: "toddler",
  young: "young kids",
  tweens: "tweens+",
};

const TRANSPORT_LABEL: Record<NonNullable<PlanAnswers["transport"]>, string> = {
  walk: "On foot",
  car: "Car",
  bike: "Bike",
};

const BUDGET_LABEL: Record<NonNullable<PlanAnswers["budget"]>, string> = {
  cheap: "$ · easy",
  mid: "$$ · one splurge",
  treat: "$$$ · treat",
};

export function whoLabel(p: ResolvedParams): string {
  if (p.who === "family" && p.kidBand) return `Family · ${KID_LABEL[p.kidBand]}`;
  return WHO_LABEL[p.who];
}

export function transportLabel(t: PlanAnswers["transport"]): string | undefined {
  return t ? TRANSPORT_LABEL[t] : undefined;
}

export function budgetLabel(b: PlanAnswers["budget"]): string | undefined {
  return b ? BUDGET_LABEL[b] : undefined;
}

const MEAL_LABEL: Record<Meal, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
};

/** "Lunch + dinner" / "No meals" style label for the params chip. */
export function mealsLabel(meals: Meal[]): string {
  if (meals.length === 0) return "No meals";
  return meals.map((m) => MEAL_LABEL[m]).join(" + ");
}
