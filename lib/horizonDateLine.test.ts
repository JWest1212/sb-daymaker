import { describe, expect, it } from "vitest";
import { HORIZONS, HORIZON_PILL, horizonDateLine } from "./explore";

// Tuesday, September 22, 2026, noon in Santa Barbara (19:00 UTC).
const TUE_SEP_22 = Date.parse("2026-09-22T19:00:00Z");
// Tuesday, October 27, 2026: that weekend runs Oct 30 to Nov 1.
const TUE_OCT_27 = Date.parse("2026-10-27T19:00:00Z");

describe("horizonDateLine", () => {
  it("names the day for Today and Tomorrow", () => {
    expect(horizonDateLine("today", TUE_SEP_22)).toBe("Tue 22");
    expect(horizonDateLine("tomorrow", TUE_SEP_22)).toBe("Wed 23");
  });

  it("gives Friday to Sunday for the weekends, with a hyphen", () => {
    expect(horizonDateLine("weekend", TUE_SEP_22)).toBe("Sep 25-27");
    expect(horizonDateLine("next_weekend", TUE_SEP_22)).toBe("Oct 2-4");
  });

  it("names both months when a weekend crosses one", () => {
    expect(horizonDateLine("weekend", TUE_OCT_27)).toBe("Oct 30-Nov 1");
  });

  it("says what Week and Month actually cover", () => {
    expect(horizonDateLine("week", TUE_SEP_22)).toBe("Next 7 days");
    expect(horizonDateLine("month", TUE_SEP_22)).toBe("Next 30 days");
  });

  it("uses Santa Barbara's day, not UTC's, late in the evening", () => {
    // 11pm Tuesday in SB is already Wednesday in UTC.
    expect(horizonDateLine("today", Date.parse("2026-09-23T06:00:00Z"))).toBe("Tue 22");
  });

  it("keeps the six tabs in the locked order with spelled-out labels", () => {
    expect(HORIZONS.map((h) => HORIZON_PILL[h])).toEqual([
      "Today", "Tomorrow", "Weekend", "Next weekend", "Week", "Month",
    ]);
  });

  it("never uses an en or em dash", () => {
    const dashes = [0x2013, 0x2014].map((c) => String.fromCharCode(c));
    for (const h of HORIZONS) {
      for (const now of [TUE_SEP_22, TUE_OCT_27]) {
        for (const d of dashes) expect(horizonDateLine(h, now)).not.toContain(d);
      }
    }
  });
});
