import { describe, it, expect } from "vitest";
import type { Thing, RecurringSchedule, HappyHourWindow } from "./things";
import { withinHorizon, sbDayOfWeek, pickEvergreenFallback } from "./explore";

// SB weekday reference instants (SB = America/Los_Angeles):
const THU = new Date("2026-07-02T19:00:00Z").getTime(); // Thu noon SB
const FRI = new Date("2026-07-03T19:00:00Z").getTime(); // Fri noon SB
const FRI_UTC_THU_SB = new Date("2026-07-03T01:00:00Z").getTime(); // Fri 01:00 UTC = Thu eve SB

function thing(over: Partial<Thing> = {}): Thing {
  return {
    id: over.id ?? "x",
    type: "place",
    title: over.id ?? "x",
    blurb: null,
    blurb_long: null,
    local_note: null,
    reason_to_go: null,
    happening_tier: 3,
    happening_category: null,
    neighborhood: null,
    nearby_zone: null,
    price_band: null,
    free: null,
    starts_at: null,
    ends_at: null,
    buy_url: null,
    time_of_day_fit: null,
    is_21_plus: false,
    indoor: false,
    photo_url: null,
    photo_source: null,
    tags: [],
    happyHours: [],
    recurring: [],
    ...over,
  };
}

function sched(day_of_week: number): RecurringSchedule {
  return { category: "market", day_of_week, start_time: null, end_time: null, label: null };
}
function window(day_of_week: number): HappyHourWindow {
  return { day_of_week, starts_local: "16:00", ends_local: "18:00", deal_text: null };
}

describe("sbDayOfWeek", () => {
  it("reads the SB-local weekday (0=Sun..6=Sat), not the browser's", () => {
    expect(sbDayOfWeek(THU)).toBe(4);
    expect(sbDayOfWeek(FRI)).toBe(5);
    // Friday in UTC but still Thursday evening in SB → Thursday.
    expect(sbDayOfWeek(FRI_UTC_THU_SB)).toBe(4);
  });
});

describe("withinHorizon — W1.3a day-aware Tier-2 on Today", () => {
  const thuMarket = thing({ id: "mkt", happening_tier: 2, recurring: [sched(4)] });

  it("a Thursday-scheduled Tier-2 shows on a Thursday Today, hides on a Friday Today", () => {
    expect(withinHorizon(thuMarket, "today", THU)).toBe(true);
    expect(withinHorizon(thuMarket, "today", FRI)).toBe(false);
  });

  it("Week/Month keep pass-all for Tier-2 regardless of weekday", () => {
    expect(withinHorizon(thuMarket, "week", FRI)).toBe(true);
    expect(withinHorizon(thuMarket, "month", FRI)).toBe(true);
  });

  it("a schedule-less Tier-2 passes on Today (can't prove it's off-day)", () => {
    const noSched = thing({ id: "ns", happening_tier: 2, recurring: [] });
    expect(withinHorizon(noSched, "today", FRI)).toBe(true);
  });

  it("respects the SB timezone boundary (Fri 01:00 UTC counts as Thursday)", () => {
    expect(withinHorizon(thuMarket, "today", FRI_UTC_THU_SB)).toBe(true);
  });

  it("applies the day rule to happyhour Tier-2 via happy_hour_windows", () => {
    const hh = thing({ id: "hh", type: "happyhour", happening_tier: 2, happyHours: [window(4)] });
    expect(withinHorizon(hh, "today", THU)).toBe(true);
    expect(withinHorizon(hh, "today", FRI)).toBe(false);
  });

  it("regression: Tier-3 is untouched on every horizon", () => {
    const evergreen = thing({ id: "ev", happening_tier: 3, recurring: [sched(4)] });
    expect(withinHorizon(evergreen, "today", FRI)).toBe(true);
    expect(withinHorizon(evergreen, "week", FRI)).toBe(true);
  });

  it("regression: Tier-1 dated bounding unchanged (today passes, yesterday fails)", () => {
    const todayEvent = thing({ id: "e1", type: "event", happening_tier: 1, starts_at: "2026-07-03T22:00:00Z" });
    const pastEvent = thing({ id: "e0", type: "event", happening_tier: 1, starts_at: "2026-07-01T22:00:00Z" });
    expect(withinHorizon(todayEvent, "today", FRI)).toBe(true);
    expect(withinHorizon(pastEvent, "today", FRI)).toBe(false);
  });
});

describe("pickEvergreenFallback — W1.3b deterministic parachute", () => {
  const pool = [
    thing({ id: "c", happening_tier: 3 }),
    thing({ id: "a", happening_tier: 3 }),
    thing({ id: "b", happening_tier: 3 }),
    thing({ id: "t1", happening_tier: 1 }),
    thing({ id: "t2", happening_tier: 2 }),
  ];

  it("is deterministic: same date + pool → same pick", () => {
    expect(pickEvergreenFallback(pool, "2026-07-02")?.id).toBe(pickEvergreenFallback(pool, "2026-07-02")?.id);
  });

  it("rotates across days", () => {
    // sorted tier-3 ids: [a,b,c]; dayOfYear 182%3=2 → c, 183%3=0 → a.
    expect(pickEvergreenFallback(pool, "2026-07-02")?.id).toBe("c");
    expect(pickEvergreenFallback(pool, "2026-07-03")?.id).toBe("a");
  });

  it("only ever returns Tier-3 things", () => {
    const picked = pickEvergreenFallback(pool, "2026-07-05");
    expect(picked?.happening_tier).toBe(3);
  });

  it("returns null when the pool has no Tier-3 things (signals Layer 2)", () => {
    const noEvergreen = [thing({ id: "t1", happening_tier: 1 }), thing({ id: "t2", happening_tier: 2 })];
    expect(pickEvergreenFallback(noEvergreen, "2026-07-02")).toBeNull();
  });
});
