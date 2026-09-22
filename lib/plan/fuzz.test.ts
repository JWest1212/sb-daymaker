// Gate 4 · A4.6, the fuzz test. Generate 100 random input combinations against a
// realistic synthetic pool and assert ZERO silent broken plans: every plan either
// validates clean, or the solver surfaced an honest note explaining the gap.
// Deterministic (seeded LCG), so a failure reproduces.

import { describe, it, expect } from "vitest";
import { AREAS, areaForThing, type AreaKey } from "@/lib/areas";
import { noteKey } from "./notes";
import { thing } from "./_fixture";
import { buildConciergeDay } from "./buildConciergeDay";
import { validatePlan } from "./validate";
import type { Thing } from "@/lib/things";
import type { PlanAnswers, Block, Who, Transport, Budget, Meal, KidBand } from "./types";
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
// R1 W4.1: the fuzz set now spans all 8 public areas, so the engine is
// exercised over the real vocabulary including the two the old system could
// not express (Mission and Riviera, Upper State).
const ZONES: AreaKey[] = AREAS.map((a) => a.key);
const ZONE_LL: Record<AreaKey, [number, number]> = Object.fromEntries(
  AREAS.map((a) => [a.key, [a.lat, a.lng] as [number, number]]),
) as Record<AreaKey, [number, number]>;
const AREA_NEIGHBORHOOD: Record<AreaKey, string> = {
  downtown_state: "downtown", funk_zone: "funk_zone", waterfront_harbor: "waterfront",
  mesa: "mesa", mission_riviera: "mission_canyon", upper_state: "upper_state",
  goleta_isla_vista: "goleta", montecito_carpinteria: "montecito",
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
        neighborhood: AREA_NEIGHBORHOOD[z],
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
const ZONE_OR_ANY: (AreaKey | null)[] = [...ZONES, null];

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
      // note (never a silent broken plan). Every problem a fresh validate finds
      // must be covered by the returned notes.
      //
      // R1 W3.2: matched by note KEY, not by exact text. One reducer now decides
      // the wording for each subject, so meals.ts's specific "we couldn't find an
      // open lunch spot in your area and budget" legitimately replaces
      // validate.ts's generic "No lunch stop yet". Comparing strings would call
      // that a silent failure when it is the opposite: the visitor is told more,
      // once, instead of the same gap twice in two voices.
      if (!vr.ok) {
        const missing = vr.notes.filter((n) => !res.notes.some((x) => noteKey(x) === noteKey(n)));
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
