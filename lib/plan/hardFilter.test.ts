// Gate 4 · A4.2, unit tests for the hard-constraint filter, one per rule.
// Also confirms the load-bearing "unknown data is never a violation" posture.

import { describe, it, expect } from "vitest";
import { thing } from "./_fixture";
import { violationReason, hardFilter, withinBudgetBand } from "./hardFilter";
import { resolveParams } from "./params";
import type { PlanAnswers } from "./types";
import type { SbNow } from "@/lib/format/openNow";

// A fixed SB "now" so the open-hours probe is deterministic. Plan date is a
// Saturday (2026-07-04 is a Saturday), afternoon.
const DATE = "2026-07-04";
const NOW: SbNow = { dow: 6, minute: 14 * 60 }; // Sat 2pm

function ctx(over: Partial<PlanAnswers> = {}, block: "morning" | "afternoon" | "night" = "afternoon") {
  const answers: PlanAnswers = { dateISO: DATE, periods: [block], who: "friends", vibes: [], zone: null, ...over };
  return { params: resolveParams(answers), block, anchorZone: over.zone ?? null, now: NOW };
}

describe("hardFilter · open-hours validity", () => {
  it("drops a venue known to be closed during the block", () => {
    // Closes at 5pm on Saturday; the afternoon probe is 2pm -> open. Make it a
    // morning-only venue so the afternoon (2pm) probe finds it closed.
    const t = thing({ id: "museum", hours: [{ dow: 6, open: "09:00", close: "12:00" }] });
    expect(violationReason(t, ctx({}, "afternoon"))).toBe("closed_in_block");
  });
  it("keeps a venue open during the block", () => {
    const t = thing({ id: "open", hours: [{ dow: 6, open: "10:00", close: "18:00" }] });
    expect(violationReason(t, ctx({}, "afternoon"))).toBeNull();
  });
  it("NEVER drops a venue with unknown hours (missing data is not a violation)", () => {
    const t = thing({ id: "nohours", hours: null });
    expect(violationReason(t, ctx({}, "afternoon"))).toBeNull();
  });
  it("drops a dated event whose start is outside the block window", () => {
    // 8pm event cannot fill an afternoon (12-5) slot.
    const t = thing({ id: "evt", type: "event", starts_at: `${DATE}T20:00:00-07:00` });
    expect(violationReason(t, ctx({}, "afternoon"))).toBe("event_outside_block");
  });
});

describe("hardFilter · recurring event start time", () => {
  // A recurring 9pm karaoke night: no starts_at, carries its time on the schedule.
  const karaoke = (over = {}) =>
    thing({
      id: "karaoke",
      starts_at: null,
      // deliberately mis-enriched (as in the live data) to prove we ignore it:
      time_of_day_fit: ["morning", "afternoon", "evening"],
      tags: ["nightlife"],
      recurring: [
        { category: "recurring_nightlife", day_of_week: 2, start_time: "21:00:00", end_time: "23:59:00", label: null, frequency: "weekly", cadence: "weekly", nth_dow: null, last_confirmed: null },
      ],
      ...over,
    });

  it("excludes a 9pm recurring event from the afternoon block", () => {
    expect(violationReason(karaoke(), ctx({}, "afternoon"))).toBe("recurring_outside_block");
  });
  it("excludes it from the morning block too", () => {
    expect(violationReason(karaoke(), ctx({}, "morning"))).toBe("recurring_outside_block");
  });
  it("allows it in the night block (21:00 is in 17-24)", () => {
    expect(violationReason(karaoke(), ctx({}, "night"))).toBeNull();
  });
  it("never constrains a recurring thing with no start_time (unknown = eligible)", () => {
    const noTime = karaoke({ recurring: [{ category: "recurring_market", day_of_week: 6, start_time: null, end_time: null, label: null, frequency: "weekly", cadence: "weekly", nth_dow: null, last_confirmed: null }] });
    expect(violationReason(noTime, ctx({}, "afternoon"))).toBeNull();
  });
});

describe("hardFilter · party rules", () => {
  it("drops a 21+ venue on a family plan", () => {
    const t = thing({ id: "bar", is_21_plus: true });
    expect(violationReason(t, ctx({ who: "family" }))).toBe("family_21_plus");
  });
  it("keeps a 21+ venue on a non-family plan", () => {
    const t = thing({ id: "bar", is_21_plus: true });
    expect(violationReason(t, ctx({ who: "couple" }))).toBeNull();
  });
  it("drops a nightlife-only spot for a toddler party", () => {
    const t = thing({ id: "club", tags: ["nightlife"] });
    expect(violationReason(t, ctx({ who: "family", kidBand: "toddler" }))).toBe("toddler_nightlife");
  });
});

describe("hardFilter · transport reachability", () => {
  const base = { id: "far", nearby_zone: "goleta" as const };
  it("drops an out-of-cluster stop on a walking plan", () => {
    const t = thing(base);
    // anchor downtown, walking -> goleta is not walkable.
    expect(violationReason(t, ctx({ zone: "downtown", transport: "walk" }))).toBe("walk_out_of_cluster");
  });
  it("keeps an in-cluster stop on a walking plan", () => {
    const t = thing({ id: "near", nearby_zone: "funk" });
    expect(violationReason(t, ctx({ zone: "downtown", transport: "walk" }))).toBeNull();
  });
  it("car unlocks a distant zone", () => {
    const t = thing(base);
    expect(violationReason(t, ctx({ zone: "downtown", transport: "car" }))).toBeNull();
  });
  it("bike reaches an adjacent zone but not a far one", () => {
    const adj = thing({ id: "mesa", nearby_zone: "mesa" });
    const far = thing({ id: "goleta", nearby_zone: "goleta" });
    expect(violationReason(adj, ctx({ zone: "waterfront", transport: "bike" }))).toBeNull();
    expect(violationReason(far, ctx({ zone: "waterfront", transport: "bike" }))).toBe("bike_out_of_range");
  });
});

describe("hardFilter · budget", () => {
  it("drops a stop more than one band above the budget cap", () => {
    const t = thing({ id: "splurge", price_band: "$$$" });
    // cheap cap = 1 ($); $$$ = 3 > 1+1 -> over budget.
    expect(violationReason(t, ctx({ budget: "cheap" }))).toBe("over_budget");
  });
  it("allows one band above (the single-splurge allowance survives the hard filter)", () => {
    const t = thing({ id: "mid", price_band: "$$" });
    // cheap cap = 1; $$ = 2 = 1+1 -> allowed by hard filter.
    expect(violationReason(t, ctx({ budget: "cheap" }))).toBeNull();
    expect(withinBudgetBand(t, "cheap")).toBe(false); // ...but not strictly in-band
  });
  it("treats a free spot as within any budget", () => {
    const t = thing({ id: "free", free: true });
    expect(withinBudgetBand(t, "cheap")).toBe(true);
    expect(violationReason(t, ctx({ budget: "cheap" }))).toBeNull();
  });
  it("never drops an unknown-price stop", () => {
    const t = thing({ id: "unknown", price_band: null, free: null });
    expect(violationReason(t, ctx({ budget: "cheap" }))).toBeNull();
  });
});

describe("hardFilter · quality tier", () => {
  it("never lets a Tier-3 thing into a plan", () => {
    const t = thing({ id: "hidden", quality_tier: 3 });
    expect(violationReason(t, ctx())).toBe("quality_tier_3");
  });
});

describe("hardFilter · composition", () => {
  it("returns only the candidates that violate nothing", () => {
    const pool = [
      thing({ id: "ok", nearby_zone: "funk" }),
      thing({ id: "bar", is_21_plus: true }),
      thing({ id: "t3", quality_tier: 3 }),
    ];
    const kept = hardFilter(pool, ctx({ who: "family", zone: "funk", transport: "car" }));
    expect(kept.map((t) => t.id)).toEqual(["ok"]);
  });
});
