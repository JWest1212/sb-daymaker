import { describe, it, expect } from "vitest";
import { chipFor, whenString, sbWhen, prioritize, rollupSources, sourceHealth, rankSourceHealth } from "./review";

describe("chipFor — trust chip from tier + starts_at", () => {
  it("dated Tier-1 -> green", () => expect(chipFor(1, "2026-07-09T20:00:00-07:00")).toBe("green"));
  it("recurring Tier-2 (no start) -> amber", () => expect(chipFor(2, null)).toBe("amber"));
  it("Tier-3 place -> evergreen", () => expect(chipFor(3, null)).toBe("evergreen"));
});

describe("whenString", () => {
  it("formats a dated start in SB time", () => {
    expect(whenString(1, "2026-07-09T19:00:00-07:00", [])).toBe("Thu Jul 9 · 7:00 PM");
  });
  it("evergreen places", () => {
    expect(whenString(3, null, [])).toBe("Evergreen · open daily");
  });
  it("monthly recurring cadence", () => {
    expect(whenString(2, null, [{ day_of_week: 4, start_time: "17:00", end_time: "20:00", frequency: "monthly", label: null }]))
      .toBe("1st Thu/month · 5:00p–8:00p");
  });
  it("uses an explicit schedule label when present", () => {
    expect(whenString(2, null, [{ day_of_week: 3, start_time: "18:00", end_time: "19:00", frequency: "weekly", label: "Wednesday Trivia Night" }]))
      .toBe("Wednesday Trivia Night");
  });
});

describe("sbWhen handles the PST boundary", () => {
  it("formats a December start at -08:00", () => {
    expect(sbWhen("2026-12-09T20:00:00-08:00")).toBe("Wed Dec 9 · 8:00 PM");
  });
});

describe("prioritize — dated soonest-first, then start-less", () => {
  it("orders dated rows ascending and pushes start-less to the end", () => {
    const rows = [
      { id: "late", starts_at: "2026-07-20T00:00:00Z" },
      { id: "place", starts_at: null },
      { id: "soon", starts_at: "2026-07-01T00:00:00Z" },
    ];
    expect(prioritize(rows).map((r) => r.id)).toEqual(["soon", "late", "place"]);
  });
});

describe("rollupSources — latest run per source -> health", () => {
  it("classifies ok / warn / fail and keeps the newest run", () => {
    const out = rollupSources([
      { source: "soho", landed: 0, fetched: 9, ok: true, started_at: "2026-06-25T09:00:00Z" },
      { source: "soho", landed: 4, fetched: 9, ok: true, started_at: "2026-06-26T09:00:00Z" }, // newer
      { source: "ticketmaster", landed: 0, fetched: 0, ok: false, started_at: "2026-06-26T09:00:00Z" },
      { source: "google_places", landed: 0, fetched: 3, ok: true, started_at: "2026-06-26T09:00:00Z" },
    ]);
    const by = Object.fromEntries(out.map((s) => [s.source, s.status]));
    expect(by).toEqual({ soho: "ok", ticketmaster: "fail", google_places: "warn" });
    expect(out.find((s) => s.source === "soho")!.landed).toBe(4); // newest run kept
  });
});

describe("sourceHealth — Phase 4, judged against the source's OWN baseline", () => {
  it("a source with no baseline yet (expected_yield 0) never false-alarms, even at 0 landed", () => {
    expect(sourceHealth({ status: "active", expected_yield: 0, last_yield: 0 })).toBe("ok");
  });
  it("flags a source that normally lands 20 and quietly drops to 1 (the exact green-0/0 gap this fixes)", () => {
    expect(sourceHealth({ status: "active", expected_yield: 20, last_yield: 1 })).toBe("below_baseline");
  });
  it("does not flag a source landing comfortably close to its own baseline", () => {
    expect(sourceHealth({ status: "active", expected_yield: 20, last_yield: 18 })).toBe("ok");
  });
  it("a paused/retired/candidate source reports paused regardless of yield", () => {
    expect(sourceHealth({ status: "paused", expected_yield: 20, last_yield: 20 })).toBe("paused");
  });
});

describe("rankSourceHealth — problems surface first", () => {
  it("sorts below_baseline, then paused, then ok; worst (highest consecutive_empty) first within a group", () => {
    const rows = [
      { key: "a", label: "A", status: "active", expected_yield: 10, last_yield: 9, last_ok_at: null, consecutive_empty: 0 },
      { key: "b", label: "B", status: "paused", expected_yield: 10, last_yield: 0, last_ok_at: null, consecutive_empty: 6 },
      { key: "c", label: "C", status: "active", expected_yield: 10, last_yield: 0, last_ok_at: null, consecutive_empty: 3 },
      { key: "d", label: "D", status: "active", expected_yield: 10, last_yield: 1, last_ok_at: null, consecutive_empty: 4 },
    ];
    expect(rankSourceHealth(rows).map((r) => r.key)).toEqual(["d", "c", "b", "a"]);
  });
});
