import { describe, it, expect } from "vitest";
import { openStateAt, clockLabel, type HourSpec } from "./openNow";

// A weekday-only cafe: Mon-Fri 8:00-17:00 (dow 1..5).
const CAFE: HourSpec[] = [1, 2, 3, 4, 5].map((dow) => ({ dow, open: "08:00", close: "17:00" }));

describe("clockLabel", () => {
  it("formats on-the-hour and half-hour without a dash or space", () => {
    expect(clockLabel("17:00")).toBe("5pm");
    expect(clockLabel("08:30")).toBe("8:30am");
    expect(clockLabel("00:00")).toBe("12am");
    expect(clockLabel("12:00")).toBe("12pm");
  });
});

describe("openStateAt", () => {
  it("reports open with a closing time during a window", () => {
    // Wednesday (dow 3) at 10:00.
    const r = openStateAt(CAFE, { dow: 3, minute: 10 * 60 });
    expect(r.state).toBe("open");
    expect(r.label).toBe("Open until 5pm");
  });

  it("reports closed and the next same-day opening before hours", () => {
    // Wednesday at 07:00, opens at 8.
    const r = openStateAt(CAFE, { dow: 3, minute: 7 * 60 });
    expect(r.state).toBe("closed");
    expect(r.label).toBe("Closed · opens 8am");
  });

  it("reports closed and the next day's opening after hours", () => {
    // Friday (dow 5) at 20:00 → next open is Monday 8am.
    const r = openStateAt(CAFE, { dow: 5, minute: 20 * 60 });
    expect(r.state).toBe("closed");
    expect(r.label).toBe("Closed · opens Mon 8am");
  });

  it("returns unknown (no label) when hours are absent", () => {
    expect(openStateAt(null, { dow: 3, minute: 600 })).toEqual({ state: "unknown", label: null });
    expect(openStateAt([], { dow: 3, minute: 600 })).toEqual({ state: "unknown", label: null });
  });

  it("handles an overnight window (bar open past midnight)", () => {
    // Friday 17:00 -> Saturday 02:00.
    const bar: HourSpec[] = [{ dow: 5, open: "17:00", close: "02:00" }];
    // Friday 23:30 → open.
    expect(openStateAt(bar, { dow: 5, minute: 23 * 60 + 30 }).state).toBe("open");
    // Saturday 01:00 → still open (spillover from Friday).
    expect(openStateAt(bar, { dow: 6, minute: 60 }).state).toBe("open");
    // Saturday 03:00 → closed.
    expect(openStateAt(bar, { dow: 6, minute: 3 * 60 }).state).toBe("closed");
  });
});
