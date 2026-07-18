import { describe, it, expect } from "vitest";
import { windowDaysFor, weekdayOf, EDITION_CONFIG, scheduledSendPassed } from "./window";

describe("windowDaysFor", () => {
  it("weekend: a Thursday edition_date covers Fri, Sat, Sun", () => {
    // 2026-07-09 is a Thursday (2026-07-02 was Thursday, per lib/explore.test.ts).
    expect(windowDaysFor("weekend", "2026-07-09")).toEqual([
      "2026-07-10", "2026-07-11", "2026-07-12",
    ]);
  });

  it("week_ahead: a Sunday edition_date covers Mon..Thu", () => {
    expect(windowDaysFor("week_ahead", "2026-07-12")).toEqual([
      "2026-07-13", "2026-07-14", "2026-07-15", "2026-07-16",
    ]);
  });

  it("never includes edition_date itself", () => {
    const days = windowDaysFor("weekend", "2026-07-09");
    expect(days).not.toContain("2026-07-09");
  });
});

describe("weekdayOf", () => {
  it("matches known SB weekday references", () => {
    expect(weekdayOf("2026-07-09")).toBe(4); // Thursday
    expect(weekdayOf("2026-07-12")).toBe(0); // Sunday
  });
});

describe("EDITION_CONFIG", () => {
  it("Thursday is conditional-anchor, Sunday is standing-anchor", () => {
    expect(EDITION_CONFIG.weekend.anchorMode).toBe("conditional");
    expect(EDITION_CONFIG.week_ahead.anchorMode).toBe("standing");
  });
});

describe("scheduledSendPassed, has an edition's normal send window (14:00 UTC on its date) passed?", () => {
  const scheduled = Date.parse("2026-07-09T14:00:00Z");

  it("is false before the scheduled hour on the edition's own date", () => {
    expect(scheduledSendPassed("2026-07-09", scheduled - 1)).toBe(false);
  });
  it("is true exactly at the scheduled hour", () => {
    expect(scheduledSendPassed("2026-07-09", scheduled)).toBe(true);
  });
  it("is true any time after the scheduled hour, same day", () => {
    expect(scheduledSendPassed("2026-07-09", scheduled + 3600_000)).toBe(true);
  });
  it("is true for a date entirely in the past", () => {
    expect(scheduledSendPassed("2026-07-01", scheduled)).toBe(true);
  });
  it("is false for a date entirely in the future", () => {
    expect(scheduledSendPassed("2026-07-12", scheduled)).toBe(false);
  });
});
