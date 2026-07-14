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
  it("returns one tile per zone, with a live count", () => {
    const things = [thing({ id: "a", nearby_zone: "funk" }), thing({ id: "b", nearby_zone: "funk" }), thing({ id: "c", nearby_zone: "goleta" })];
    const tiles = placeTiles(things);
    expect(tiles.find((t) => t.key === "funk")?.count).toBe(2);
    expect(tiles.find((t) => t.key === "goleta")?.count).toBe(1);
    expect(tiles.find((t) => t.key === "downtown")?.count).toBe(0);
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
    const things = [thing({ id: "a", nearby_zone: "mesa" })];
    expect(tilesFor("place", things).find((t) => t.key === "mesa")?.count).toBe(1);
    expect(tilesFor("vibe", things)).toHaveLength(6);
    expect(tilesFor("activity", things)).toHaveLength(10);
  });
});
