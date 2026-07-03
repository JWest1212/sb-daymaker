import { describe, it, expect } from "vitest";
import type { Thing } from "./things";
import { filterByState, splitPast, beenList, type SavesMap } from "./savedView";

// Minimal Thing factory — only the fields these selectors read matter.
function thing(id: string, over: Partial<Thing> = {}): Thing {
  return {
    id,
    type: "place",
    title: id,
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

describe("filterByState", () => {
  const a = thing("a");
  const b = thing("b");
  const c = thing("c");
  const pool = [a, b, c];

  it("is value-sensitive: a want→been flip in a NEW map re-derives (the regression)", () => {
    const before: SavesMap = { a: "want", b: "want", c: "been" };
    expect(filterByState(pool, before, "want").map((t) => t.id)).toEqual(["a", "b"]);
    expect(filterByState(pool, before, "been").map((t) => t.id)).toEqual(["c"]);

    // Flip b to "been" in a brand-new object (mirrors immutable provider update).
    const after: SavesMap = { ...before, b: "been" };
    expect(filterByState(pool, after, "want").map((t) => t.id)).toEqual(["a"]);
    expect(filterByState(pool, after, "been").map((t) => t.id)).toEqual(["b", "c"]);
  });

  it("excludes a missing entry and treats an explicit \"want\" as want", () => {
    const saves: SavesMap = { a: "want" }; // b, c not saved
    expect(filterByState(pool, saves, "want").map((t) => t.id)).toEqual(["a"]);
    expect(filterByState(pool, saves, "been")).toEqual([]);
  });
});

describe("splitPast", () => {
  // Fixed reference clock: 2026-07-03T18:00:00Z.
  const nowMs = new Date("2026-07-03T18:00:00Z").getTime();
  const earlierToday = thing("earlier", { type: "event", starts_at: "2026-07-03T09:00:00Z" });
  const laterToday = thing("later", { type: "event", starts_at: "2026-07-03T21:00:00Z" });
  const yesterday = thing("yesterday", { type: "event", starts_at: "2026-07-02T20:00:00Z" });
  const placeNoDate = thing("place"); // non-event, never past

  it("routes only already-started dated events to past", () => {
    const { current, past } = splitPast(
      [earlierToday, laterToday, yesterday, placeNoDate],
      nowMs,
    );
    expect(past.map((t) => t.id)).toEqual(["earlier", "yesterday"]);
    expect(current.map((t) => t.id)).toEqual(["later", "place"]);
  });
});

describe("beenList", () => {
  it("returns only been-state things present in the pool, in saves-key order", () => {
    const pool = [thing("a"), thing("b"), thing("c")];
    // d is been but absent from the pool → excluded; order follows map keys.
    const saves: SavesMap = { c: "been", a: "want", b: "been", d: "been" };
    expect(beenList(pool, saves).map((t) => t.id)).toEqual(["c", "b"]);
  });
});
