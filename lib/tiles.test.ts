import { describe, it, expect } from "vitest";
import type { Thing } from "./things";
import { placeTiles, vibeTiles, activityTiles, tilesFor } from "./tiles";

function thing(over: Partial<Thing> = {}): Thing {
  return {
    id: over.id ?? "x",
    type: "event",
    title: over.id ?? "x",
    blurb: null,
    blurb_long: null,
    local_note: null,
    reason_to_go: null,
    happening_tier: 1,
    editorial_weight: 0,
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

describe("placeTiles", () => {
  it("returns one tile per door zone, counted from neighborhood", () => {
    const things = [
      thing({ id: "a", neighborhood: "funk_zone" }),
      thing({ id: "b", neighborhood: "funk_zone" }),
      thing({ id: "c", neighborhood: "goleta" }),
    ];
    const tiles = placeTiles(things);
    expect(tiles).toHaveLength(8);
    expect(tiles.find((t) => t.key === "funk_zone")?.count).toBe(2);
    expect(tiles.find((t) => t.key === "goleta_isla_vista")?.count).toBe(1);
    expect(tiles.find((t) => t.key === "downtown_state")?.count).toBe(0);
  });

  it("collapses the two joined neighborhoods into one door zone each", () => {
    const things = [thing({ id: "a", neighborhood: "mission_canyon" }), thing({ id: "b", neighborhood: "riviera" })];
    const tiles = placeTiles(things);
    expect(tiles.find((t) => t.key === "mission_riviera")?.count).toBe(2);
  });

  it("doesn't count 'other' or unset neighborhoods toward any zone", () => {
    const things = [thing({ id: "a", neighborhood: "other" }), thing({ id: "b", neighborhood: null })];
    const tiles = placeTiles(things);
    expect(tiles.every((t) => t.count === 0)).toBe(true);
  });
});

describe("vibeTiles", () => {
  it("counts things carrying that occasion tag", () => {
    const things = [thing({ id: "a", tags: ["solo"] }), thing({ id: "b", tags: ["solo", "free_sb"] })];
    const tiles = vibeTiles(things);
    expect(tiles.find((t) => t.key === "solo")?.count).toBe(2);
    expect(tiles.find((t) => t.key === "free_sb")?.count).toBe(1);
    expect(tiles.find((t) => t.key === "nightlife")?.count).toBe(0);
  });

  it("always shows the Rainy Day tile, any day (2026-07-14: no longer weather-gated)", () => {
    const things = [thing({ id: "a", tags: ["rainy_day"] })];
    const tiles = vibeTiles(things);
    expect(tiles).toHaveLength(7);
    expect(tiles.find((t) => t.key === "rainy_day")?.count).toBe(1);
  });

  it("self-gates the Dog Friendly tile — never dead-ends, appears only once a thing carries the tag", () => {
    const noneMarked = [thing({ id: "a", tags: ["solo"] })];
    expect(vibeTiles(noneMarked).find((t) => t.key === "dog_friendly")).toBeUndefined();

    const oneMarked = [thing({ id: "a", tags: ["solo"] }), thing({ id: "b", tags: ["dog_friendly"] })];
    const tiles = vibeTiles(oneMarked);
    expect(tiles.find((t) => t.key === "dog_friendly")?.count).toBe(1);
  });
});

describe("activityTiles", () => {
  it("counts things carrying that activity", () => {
    const things = [thing({ id: "a", activities: ["outdoors"] }), thing({ id: "b", activities: [] })];
    const tiles = activityTiles(things);
    expect(tiles.find((t) => t.key === "outdoors")?.count).toBe(1);
    expect(tiles.find((t) => t.key === "nightlife")?.count).toBe(0);
  });
});

describe("tilesFor", () => {
  it("dispatches to the right builder per dimension", () => {
    const things = [thing({ id: "a", neighborhood: "mesa" })];
    expect(tilesFor("place", things).find((t) => t.key === "mesa")?.count).toBe(1);
    expect(tilesFor("vibe", things)).toHaveLength(7);
    expect(tilesFor("activity", things)).toHaveLength(10);
  });
});
