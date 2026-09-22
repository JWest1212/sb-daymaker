import { describe, it, expect } from "vitest";
import type { Thing } from "./things";
import { filterByState, splitPast, beenList, partitionSaves, type SavesMap } from "./savedView";

// Minimal Thing factory, only the fields these selectors read matter.
function thing(id: string, over: Partial<Thing> = {}): Thing {
  return {
    id,
    type: "place",
    status: "published",
    hero_eligible: true,
    is_civic: false,
    source: null,
    title: id,
    blurb: null,
    blurb_long: null,
    local_note: null,
    reason_to_go: null,
    happening_tier: 3,
    editorial_weight: 0,
    happening_category: null,
    neighborhood: null,
    nearby_zone: null,
    address: null,
    lat: null,
    lng: null,
    quality_tier: 1,
    hours: null,
    verified_at: null,
    verified_by: null,
    last_confirmed: null,
    setting: null,
    practical_note: null,
    slug: null,
    updated_at: null,
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
    photo_attribution: null,
    visual_kind: null,
    visual_key: null,
    visual_seed: null,
    venue_id: null,
    tags: [],
    activities: [],
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

describe("partitionSaves (R1 W1.1, saves are never deleted)", () => {
  const a = thing("a", { happening_tier: 1, starts_at: "2026-09-22T18:00:00Z" });
  const b = thing("b", { happening_tier: 3, starts_at: null });

  it("renders the rows it has and lists the rest as missing, keeping every id", () => {
    // The spec case: three saved ids, the lookup returns two.
    const lookup = new Map([
      ["a", a],
      ["b", b],
    ]);
    const answered = new Set(["a", "b", "c"]);
    const { found, missing } = partitionSaves(["a", "b", "c"], lookup, answered);
    expect(found.map((t) => t.id)).toEqual(["a", "b"]);
    expect(missing).toEqual(["c"]);
    // Nothing is dropped on the floor: every saved id is accounted for.
    expect(found.length + missing.length).toBe(3);
  });

  it("does not call an id missing until the lookup has actually answered for it", () => {
    // In flight: neither rendered nor reported gone. This is the guard against a
    // slow or failed network reading as "deleted".
    const { found, missing } = partitionSaves(["a", "c"], new Map([["a", a]]), new Set(["a"]));
    expect(found.map((t) => t.id)).toEqual(["a"]);
    expect(missing).toEqual([]);
  });

  it("treats an archived row as found, not missing", () => {
    const archived = thing("z", { status: "archived", happening_tier: 1, starts_at: "2026-06-27T18:00:00Z" });
    const { found, missing } = partitionSaves(["z"], new Map([["z", archived]]), new Set(["z"]));
    expect(found.map((t) => t.id)).toEqual(["z"]);
    expect(missing).toEqual([]);
  });

  it("orders found rows by tier, then soonest start, with evergreen last", () => {
    const soon = thing("soon", { happening_tier: 1, starts_at: "2026-09-21T18:00:00Z" });
    const later = thing("later", { happening_tier: 1, starts_at: "2026-09-25T18:00:00Z" });
    const ever = thing("ever", { happening_tier: 1, starts_at: null });
    const lookup = new Map([
      ["ever", ever],
      ["later", later],
      ["soon", soon],
    ]);
    const { found } = partitionSaves(
      ["ever", "later", "soon"],
      lookup,
      new Set(["ever", "later", "soon"]),
    );
    expect(found.map((t) => t.id)).toEqual(["soon", "later", "ever"]);
  });

  it("returns empty lists for an empty save set", () => {
    expect(partitionSaves([], new Map(), new Set())).toEqual({ found: [], missing: [] });
  });
});
