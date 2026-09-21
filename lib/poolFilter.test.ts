import { describe, it, expect } from "vitest";
import {
  freshnessOrFilter,
  freshnessCutoff,
  startFallbackCutoff,
  isFresh,
  STALE_GRACE_HOURS,
  ASSUMED_EVENT_HOURS,
} from "./poolFilter";

// A fixed clock, so none of this depends on the day it runs. (The one failing
// test at the R1 baseline was a date-dependent test, see BASELINE.md.)
const NOW = new Date("2026-09-21T12:00:00-07:00");
const HOUR = 60 * 60 * 1000;
const iso = (hoursFromNow: number) => new Date(NOW.getTime() + hoursFromNow * HOUR).toISOString();

describe("the freshness rule (R1 W1.2)", () => {
  it("keeps an evergreen row, which has no start at all", () => {
    expect(isFresh({ starts_at: null, ends_at: null }, NOW)).toBe(true);
  });

  it("keeps a row that ended yesterday", () => {
    // 20 hours ago is inside the 24-hour grace.
    expect(isFresh({ starts_at: iso(-23), ends_at: iso(-20) }, NOW)).toBe(true);
  });

  it("drops a row that ended two days ago", () => {
    expect(isFresh({ starts_at: iso(-50), ends_at: iso(-48) }, NOW)).toBe(false);
  });

  it("keeps a row happening right now", () => {
    expect(isFresh({ starts_at: iso(-1), ends_at: iso(2) }, NOW)).toBe(true);
  });

  it("keeps a row still in the future", () => {
    expect(isFresh({ starts_at: iso(72), ends_at: null }, NOW)).toBe(true);
  });

  it("assumes a four-hour run when the row states no end", () => {
    // Started 27h ago: 27 - 4 = 23h past its assumed end, inside the 24h grace.
    expect(isFresh({ starts_at: iso(-27), ends_at: null }, NOW)).toBe(true);
    // Started 29h ago: its assumed end was 25h ago, outside the grace.
    expect(isFresh({ starts_at: iso(-29), ends_at: null }, NOW)).toBe(false);
  });

  it("treats the grace boundary as inclusive", () => {
    expect(isFresh({ starts_at: iso(-30), ends_at: iso(-STALE_GRACE_HOURS) }, NOW)).toBe(true);
  });

  it("prefers a stated end over the assumed one", () => {
    // A long festival that started 3 days ago but runs until tomorrow stays.
    expect(isFresh({ starts_at: iso(-72), ends_at: iso(24) }, NOW)).toBe(true);
  });
});

describe("the PostgREST predicate builder (R1 W1.2)", () => {
  it("offsets the cutoffs by the documented amounts", () => {
    expect(NOW.getTime() - freshnessCutoff(NOW).getTime()).toBe(STALE_GRACE_HOURS * HOUR);
    expect(freshnessCutoff(NOW).getTime() - startFallbackCutoff(NOW).getTime()).toBe(
      ASSUMED_EVENT_HOURS * HOUR,
    );
  });

  it("emits the three branches PostgREST needs, in a parseable shape", () => {
    const f = freshnessOrFilter(NOW);
    expect(f).toBe(
      `starts_at.is.null,ends_at.gte.${freshnessCutoff(NOW).toISOString()},` +
        `and(ends_at.is.null,starts_at.gte.${startFallbackCutoff(NOW).toISOString()})`,
    );
  });

  it("emits no comma or parenthesis inside an interpolated timestamp", () => {
    // PostgREST's filter grammar is comma-delimited, so a timestamp containing a
    // comma would silently split the predicate into the wrong branches.
    for (const ts of [freshnessCutoff(NOW).toISOString(), startFallbackCutoff(NOW).toISOString()]) {
      expect(ts).not.toMatch(/[,()]/);
    }
  });

  it("moves with the clock rather than pinning a build-time date", () => {
    const later = new Date(NOW.getTime() + 6 * HOUR);
    expect(freshnessOrFilter(later)).not.toBe(freshnessOrFilter(NOW));
  });
});
