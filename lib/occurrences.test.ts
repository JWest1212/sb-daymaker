import { describe, it, expect } from "vitest";
import { occurrencesInWindow, occurrencesByWindow, occursOnDate, type OccThing } from "./occurrences";

// Anchor "today" to Wed Jul 1 2026 (noon PDT) — the mockup's reference date.
// Window offsets from here: 7d = Jul 1–7, 14d = Jul 1–14, 30d = Jul 1–30,
// 45d = Jul 1 – Aug 14.
const NOW = Date.parse("2026-07-01T12:00:00-07:00");

const t1 = (starts_at: string | null): OccThing => ({ happening_tier: 1, starts_at, recurring: [] });
const t2 = (recurring: OccThing["recurring"]): OccThing => ({ happening_tier: 2, starts_at: null, recurring });
const t3 = (): OccThing => ({ happening_tier: 3, starts_at: null, recurring: [] });

describe("Tier-1 dated occurrences", () => {
  it("counts a start within the window as 1", () => {
    const jul4 = t1("2026-07-04T19:00:00-07:00");
    expect(occurrencesInWindow(jul4, 7, NOW)).toBe(1);
    expect(occurrencesInWindow(jul4, 45, NOW)).toBe(1);
  });
  it("counts today's event (time already passed) as 1", () => {
    const todayEarly = t1("2026-07-01T09:00:00-07:00");
    expect(occurrencesInWindow(todayEarly, 7, NOW)).toBe(1);
  });
  it("excludes a past date", () => {
    expect(occurrencesInWindow(t1("2026-06-30T19:00:00-07:00"), 45, NOW)).toBe(0);
  });
  it("respects the window edge (Jul 20 is out at 14d, in at 30d)", () => {
    const jul20 = t1("2026-07-20T19:00:00-07:00");
    expect(occurrencesInWindow(jul20, 7, NOW)).toBe(0);
    expect(occurrencesInWindow(jul20, 14, NOW)).toBe(0);
    expect(occurrencesInWindow(jul20, 30, NOW)).toBe(1);
  });
  it("excludes a date beyond 45d", () => {
    expect(occurrencesInWindow(t1("2026-08-20T19:00:00-07:00"), 45, NOW)).toBe(0);
  });
});

describe("Tier-2 weekly", () => {
  const tue = t2([{ day_of_week: 2, frequency: "weekly" }]); // Tuesdays
  it("counts each weekday occurrence exactly", () => {
    expect(occurrencesInWindow(tue, 7, NOW)).toBe(1);  // Jul 7
    expect(occurrencesInWindow(tue, 14, NOW)).toBe(2); // Jul 7, 14
    expect(occurrencesInWindow(tue, 30, NOW)).toBe(4); // Jul 7,14,21,28
    expect(occurrencesInWindow(tue, 45, NOW)).toBe(6); // + Aug 4, 11
  });
  it("counts a weekday that includes today", () => {
    const wed = t2([{ day_of_week: 3, frequency: "weekly" }]); // Wed = today
    expect(occurrencesInWindow(wed, 7, NOW)).toBe(1);  // Jul 1 (Jul 8 is offset 7, out)
    expect(occurrencesInWindow(wed, 14, NOW)).toBe(2); // Jul 1, 8
    expect(occurrencesInWindow(wed, 45, NOW)).toBe(7); // Jul 1,8,15,22,29 + Aug 5,12
  });
});

describe("Tier-2 monthly (1st weekday of month)", () => {
  const firstThu = t2([{ day_of_week: 4, frequency: "monthly" }]); // 1st Thursday
  it("counts only the 1st-of-month occurrence", () => {
    expect(occurrencesInWindow(firstThu, 7, NOW)).toBe(1);  // Jul 2
    expect(occurrencesInWindow(firstThu, 14, NOW)).toBe(1); // still just Jul 2
    expect(occurrencesInWindow(firstThu, 30, NOW)).toBe(1); // Aug 6 not reached
    expect(occurrencesInWindow(firstThu, 45, NOW)).toBe(2); // Jul 2 + Aug 6
  });
});

describe("Tier-2 biweekly (every other week from first in-window)", () => {
  const biFri = t2([{ day_of_week: 5, frequency: "biweekly" }]); // Fridays, biweekly
  it("counts ceil(matches/2)", () => {
    expect(occurrencesInWindow(biFri, 7, NOW)).toBe(1);  // 1 Friday -> 1
    expect(occurrencesInWindow(biFri, 14, NOW)).toBe(1); // 2 Fridays -> 1
    expect(occurrencesInWindow(biFri, 30, NOW)).toBe(2); // 4 Fridays -> 2
    expect(occurrencesInWindow(biFri, 45, NOW)).toBe(4); // 7 Fridays -> 4
  });
});

describe("multiple schedules sum", () => {
  it("adds occurrences across rows", () => {
    const both = t2([
      { day_of_week: 2, frequency: "weekly" }, // Tue -> 1 in 7d
      { day_of_week: 3, frequency: "weekly" }, // Wed -> 1 in 7d
    ]);
    expect(occurrencesInWindow(both, 7, NOW)).toBe(2);
  });
  it("ignores rows with no day_of_week", () => {
    const partial = t2([{ day_of_week: null, frequency: "weekly" }]);
    expect(occurrencesInWindow(partial, 45, NOW)).toBe(0);
  });
});

describe("Tier-3 evergreen", () => {
  it("never contributes occurrences", () => {
    expect(occurrencesInWindow(t3(), 45, NOW)).toBe(0);
  });
});

describe("occursOnDate", () => {
  // Jul 1 2026 = Wed; Jul 2 = Thu (1st Thursday); Jul 9 = Thu (2nd).
  it("Tier-1 occurs only on its own SB date", () => {
    const jul4 = t1("2026-07-04T19:00:00-07:00");
    expect(occursOnDate(jul4, "2026-07-04")).toBe(true);
    expect(occursOnDate(jul4, "2026-07-05")).toBe(false);
  });
  it("Tier-2 weekly occurs on matching weekday", () => {
    const thu = t2([{ day_of_week: 4, frequency: "weekly" }]);
    expect(occursOnDate(thu, "2026-07-02")).toBe(true);  // Thu
    expect(occursOnDate(thu, "2026-07-03")).toBe(false); // Fri
  });
  it("Tier-2 monthly occurs only on the 1st matching weekday", () => {
    const firstThu = t2([{ day_of_week: 4, frequency: "monthly" }]);
    expect(occursOnDate(firstThu, "2026-07-02")).toBe(true);  // 1st Thursday
    expect(occursOnDate(firstThu, "2026-07-09")).toBe(false); // 2nd Thursday
  });
  it("Tier-3 evergreen occurs any day", () => {
    expect(occursOnDate(t3(), "2026-07-04")).toBe(true);
    expect(occursOnDate(t3(), "2026-12-25")).toBe(true);
  });
});

describe("occurrencesByWindow", () => {
  it("returns all four cumulative windows, non-decreasing", () => {
    const tue = t2([{ day_of_week: 2, frequency: "weekly" }]);
    expect(occurrencesByWindow(tue, NOW)).toEqual({ 7: 1, 14: 2, 30: 4, 45: 6 });
  });
  it("matches occurrencesInWindow for a dated Tier-1", () => {
    const jul20 = t1("2026-07-20T19:00:00-07:00");
    expect(occurrencesByWindow(jul20, NOW)).toEqual({ 7: 0, 14: 0, 30: 1, 45: 1 });
  });
});
