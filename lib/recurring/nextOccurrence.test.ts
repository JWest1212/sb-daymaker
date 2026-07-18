import { describe, it, expect } from "vitest";
import { nextOccurrence, nextOccurrenceForThing, formatNextDate } from "./nextOccurrence";

// Reference: 2026-07-20 is a Monday (UTC/SB date key).
const MON_2026_07_20 = new Date("2026-07-20T19:00:00Z").getTime();

describe("nextOccurrence", () => {
  it("weekly: next matching weekday on/after fromKey", () => {
    // Friday (dow 5) from Monday 2026-07-20 -> Fri 2026-07-24.
    expect(nextOccurrence({ day_of_week: 5, cadence: "weekly" }, "2026-07-20")).toBe("2026-07-24");
  });
  it("weekly: returns the same day when fromKey is that weekday", () => {
    expect(nextOccurrence({ day_of_week: 1, cadence: "weekly" }, "2026-07-20")).toBe("2026-07-20");
  });
  it("monthly_nth_dow: first Thursday of the month", () => {
    // From 2026-07-20, the next 1st Thursday is 2026-08-06.
    expect(nextOccurrence({ day_of_week: 4, cadence: "monthly_nth_dow", nth_dow: 1 }, "2026-07-20")).toBe("2026-08-06");
  });
  it("bimonthly: nth weekday on every-other month from the anchor", () => {
    // 1st Saturday, anchor last_confirmed 2026-06 (even parity vs Aug), from Jul 20.
    // Jul (odd offset from Jun) is skipped; next same-parity is Aug -> 1st Sat = 2026-08-01.
    const d = nextOccurrence({ day_of_week: 6, cadence: "bimonthly", nth_dow: 1, last_confirmed: "2026-06-15" }, "2026-07-20");
    expect(d).toBe("2026-08-01");
  });
  it("irregular/seasonal: no honest date", () => {
    expect(nextOccurrence({ day_of_week: 3, cadence: "irregular" }, "2026-07-20")).toBeNull();
    expect(nextOccurrence({ day_of_week: 3, cadence: "seasonal" }, "2026-07-20")).toBeNull();
  });
  it("falls back to legacy frequency when cadence is absent", () => {
    expect(nextOccurrence({ day_of_week: 5, frequency: "weekly" }, "2026-07-20")).toBe("2026-07-24");
  });
});

describe("nextOccurrenceForThing", () => {
  it("picks the soonest across rows and carries its time", () => {
    const r = nextOccurrenceForThing(
      [
        { day_of_week: 5, cadence: "weekly", start_time: "17:00:00" }, // Fri
        { day_of_week: 2, cadence: "weekly", start_time: "10:00:00" }, // Tue (sooner)
      ],
      MON_2026_07_20,
    );
    expect(r).toEqual({ date: "2026-07-21", time: "10:00:00" }); // Tue Jul 21
  });
  it("returns 'irregular' when rows exist but none can be dated", () => {
    expect(nextOccurrenceForThing([{ day_of_week: 3, cadence: "irregular" }], MON_2026_07_20)).toBe("irregular");
  });
  it("returns null when there are no recurring rows", () => {
    expect(nextOccurrenceForThing([], MON_2026_07_20)).toBeNull();
  });
});

describe("formatNextDate", () => {
  it("formats date + time", () => {
    expect(formatNextDate({ date: "2026-07-24", time: "17:00:00" })).toBe("Fri Jul 24, 5pm");
  });
  it("omits time when unknown", () => {
    expect(formatNextDate({ date: "2026-07-24", time: null })).toBe("Fri Jul 24");
  });
});
