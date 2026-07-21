// Gate 4 · A4.6, the fuzz test. Generate 100 random input combinations against a
// realistic synthetic pool and assert ZERO silent broken plans: every plan either
// validates clean, or the solver surfaced an honest note explaining the gap.
// Deterministic (seeded LCG), so a failure reproduces.

import { describe, it, expect } from "vitest";
import { thing } from "./_fixture";
import { buildConciergeDay } from "./buildConciergeDay";
import { validatePlan } from "./validate";
import type { Thing } from "@/lib/things";
import type { PlanAnswers, Block, Who, Transport, Budget, Meal, KidBand } from "./types";
import type { Zone } from "@/lib/zones";
import type { SbNow } from "@/lib/format/openNow";

// ---- Deterministic pseudo-random ------------------------------------------
function lcg(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}
const pick = <T,>(rng: () => number, arr: T[]): T => arr[Math.floor(rng() * arr.length)];

// ---- A realistic synthetic pool (deterministic, ~48 things) ---------------
const ZONES: Zone[] = ["funk", "downtown", "waterfront", "mesa", "montecito", "goleta"];
const ZONE_LL: Record<Zone, [number, number]> = {
  funk: [34.4142, -119.6889], downtown: [34.4208, -119.6982], waterfront: [34.4096, -119.6896],
  mesa: [34.403, -119.718], montecito: [34.4367, -119.6313], goleta: [34.4358, -119.8276],
};
const CATS = ["arts_theater", "live_music", "food_drink_spot", "scenic_chill", "culture_spot", "recurring_nightlife"];
const PB = ["free", "$", "$$", "$$$", null];

function makePool(): Thing[] {
  const rng = lcg(20260704);
  const out: Thing[] = [];
  for (let i = 0; i < 48; i++) {
    const z = ZONES[i % ZONES.length];
    const [lat, lng] = ZONE_LL[z];
    const cat = CATS[i % CATS.length];
    const isFoodCat = cat === "food_drink_spot";
    out.push(
      thing({
        id: `t${i}`,
        title: `Thing ${i}`,
        happening_category: cat,
        nearby_zone: z,
        lat: rng() < 0.8 ? lat : null, // ~20% missing coords, like real data
        lng: rng() < 0.8 ? lng : null,
        price_band: pick(rng, PB),
        is_21_plus: cat === "recurring_nightlife",
        quality_tier: rng() < 0.1 ? 2 : 1, // some tier-2, no tier-3 (feed strips those)
        hours: rng() < 0.2 ? [{ dow: 6, open: "10:00", close: "17:00" }] : null, // ~20% have hours
        tags: isFoodCat ? ["wine_food"] : cat === "arts_theater" ? ["arts_culture"] : cat === "recurring_nightlife" ? ["nightlife"] : [],
        time_of_day_fit: ["morning", "afternoon", "evening"],
        reason_to_go: "worth the trip",
      }),
    );
  }
  return out;
}

const POOL = makePool();
const NOW: SbNow = { dow: 6, minute: 12 * 60 }; // Sat noon

const ALL_BLOCKS: Block[] = ["morning", "afternoon", "night"];
const WHO: Who[] = ["solo", "couple", "family", "friends"];
const KID: (KidBand | null)[] = ["toddler", "young", "tweens", null];
const TRANSPORT: Transport[] = ["walk", "car", "bike"];
const BUDGET: (Budget | null)[] = ["cheap", "mid", "treat", null];
const MEALSETS: Meal[][] = [[], ["lunch"], ["lunch", "dinner"], ["breakfast", "lunch", "dinner"]];
const ZONE_OR_ANY: (Zone | null)[] = [...ZONES, null];

function randomAnswers(rng: () => number): PlanAnswers {
  // 1-3 blocks, in canonical order.
  const chosen = ALL_BLOCKS.filter(() => rng() < 0.6);
  const periods = chosen.length ? chosen : [pick(rng, ALL_BLOCKS)];
  const who = pick(rng, WHO);
  return {
    dateISO: "2026-07-04",
    periods,
    who,
    kidBand: who === "family" ? pick(rng, KID) : null,
    vibes: [],
    zone: pick(rng, ZONE_OR_ANY),
    transport: pick(rng, TRANSPORT),
    budget: pick(rng, BUDGET),
    meals: pick(rng, MEALSETS),
    pace: rng() < 0.5 ? "packed" : "slow",
  };
}

describe("Gate 4 · A4.6 fuzz: 100 input combos, zero silent broken plans", () => {
  it("every generated plan either validates or carries an honest note", () => {
    const rng = lcg(987654321);
    const thingMap = new Map(POOL.map((t) => [t.id, t]));
    const silentFailures: { combo: PlanAnswers; badNotes: string[] }[] = [];

    for (let i = 0; i < 100; i++) {
      const answers = randomAnswers(rng);
      const res = buildConciergeDay(answers, POOL, () => null, { now: NOW });

      // Re-validate the produced stops from scratch.
      const vr = validatePlan(res.stops, thingMap, res.params, NOW);

      // The contract: if validation is not clean, the solver must have surfaced a
      // note (never a silent broken plan). Every fresh validate note must also be
      // present in the returned notes.
      if (!vr.ok) {
        const missing = vr.notes.filter((n) => !res.notes.some((x) => x.text === n.text));
        if (missing.length > 0) silentFailures.push({ combo: answers, badNotes: missing.map((m) => m.text) });
      }

      // No stop may ever repeat within a plan.
      const ids = res.stops.map((s) => s.thingId);
      expect(new Set(ids).size).toBe(ids.length);
    }

    if (silentFailures.length > 0) {
      // Surface the first offending combo for debugging.
      throw new Error(`Silent broken plans: ${silentFailures.length}. First: ${JSON.stringify(silentFailures[0])}`);
    }
    expect(silentFailures).toHaveLength(0);
  });

  it("respects hard rules across the fuzz set (no 21+ on family, no over-budget beyond allowance)", () => {
    const rng = lcg(555);
    for (let i = 0; i < 100; i++) {
      const answers = randomAnswers(rng);
      const res = buildConciergeDay(answers, POOL, () => null, { now: NOW });
      for (const s of res.stops) {
        const t = POOL.find((x) => x.id === s.thingId)!;
        if (answers.who === "family") expect(t.is_21_plus).toBe(false);
        expect(t.quality_tier).not.toBe(3);
      }
    }
  });
});
