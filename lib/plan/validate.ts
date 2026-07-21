// Gate 4 · G4.6, the validation pass (belt and suspenders). After assembly, assert
// the finished plan violates nothing: every stop open at its block, transitions
// physically plausible for the transport mode, budget respected, party rules
// respected, no duplicate stop, meals present as requested. Anything that slipped
// through (e.g. a user swap) surfaces as an honest PlanNote instead of a silent
// broken plan. Pure, no I/O, no AI. No em dash (Golden Rule).

import type { Thing } from "@/lib/things";
import type { PlanNote, ResolvedParams, Stop } from "./types";
import { violationReason } from "./hardFilter";
import { withinClusterFootprint, anchorZoneFor } from "./cluster";
import { isFood, mealBlock } from "./meals";
import type { SbNow } from "@/lib/format/openNow";
import type { Zone } from "@/lib/zones";

export interface ValidateResult {
  ok: boolean;
  notes: PlanNote[];
}

/** Validate an assembled plan. `ok` is true when nothing is provably broken;
 *  notes carry honest explanations for anything that is. Unknown data (no hours,
 *  no price) is never a violation, matching the hard filter. */
export function validatePlan(
  stops: Stop[],
  thingMap: Map<string, Thing>,
  params: ResolvedParams,
  now?: SbNow,
): ValidateResult {
  const notes: PlanNote[] = [];
  const things = stops
    .map((s) => thingMap.get(s.thingId))
    .filter((t): t is Thing => Boolean(t));
  const anchorZone: Zone | null = anchorZoneFor(params, things);

  // 1. No duplicate stop.
  const seen = new Set<string>();
  for (const s of stops) {
    if (seen.has(s.thingId)) {
      notes.push({ kind: "cluster", text: "A stop is repeated. Remove the duplicate." });
      break;
    }
    seen.add(s.thingId);
  }

  // 2. Every stop satisfies the hard rules for its own block (open, party, budget,
  //    reachability). A user swap can reintroduce a violation; catch it here.
  for (const s of stops) {
    const t = thingMap.get(s.thingId);
    if (!t) continue;
    const reason = violationReason(t, { params, block: s.block, anchorZone, now });
    if (reason === "closed_in_block" || reason === "event_outside_block") {
      notes.push({ kind: "empty_block", text: `${t.title} may be closed at that time. Swap it or check hours.` });
    } else if (reason === "over_budget") {
      notes.push({ kind: "budget", text: `${t.title} is above your budget. Swap it or bump the budget.` });
    } else if (reason === "family_21_plus" || reason === "toddler_late_night" || reason === "toddler_nightlife") {
      notes.push({ kind: "cluster", text: `${t.title} isn't a fit for your party. Swap it.` });
    }
  }

  // 3. Cluster footprint: walking stays in one walk-cluster; car/bike within two.
  const zones = things.map((t) => t.nearby_zone).filter((z): z is Zone => Boolean(z));
  if (zones.length > 1) {
    let ok = true;
    for (let i = 1; i < zones.length; i++) {
      if (!withinClusterFootprint(zones.slice(0, i), zones[i], params)) { ok = false; break; }
    }
    if (!ok) {
      notes.push({
        kind: "cluster",
        text:
          params.transport === "walk"
            ? "This day spreads past one walkable area. Drive, or drop the far stop."
            : "This day spans more than two areas. Tighten it to save driving.",
      });
    }
  }

  // 4. Meals present as requested (only for meals whose block is active).
  for (const meal of params.meals) {
    const block = mealBlock(meal, params.periods);
    if (!block) continue;
    const hasFood = stops.some((s) => s.block === block && (() => {
      const t = thingMap.get(s.thingId);
      return t ? isFood(t) : false;
    })());
    if (!hasFood) {
      notes.push({ kind: "meal_unfilled", text: `No ${meal} stop yet. Add one so the day has a meal at mealtime.` });
    }
  }

  return { ok: notes.length === 0, notes };
}
