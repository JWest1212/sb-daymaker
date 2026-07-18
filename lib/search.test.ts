import { describe, it, expect } from "vitest";
import type { Thing } from "./things";
import { searchThings, normalizeQuery } from "./search";

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

describe("normalizeQuery", () => {
  it("trims and lowercases", () => {
    expect(normalizeQuery("  Jazz Night  ")).toBe("jazz night");
  });
});

describe("searchThings, events", () => {
  it("returns nothing for an empty query", () => {
    const r = searchThings({ query: "  ", things: [thing({ title: "Jazz Night" })], venueNames: {} });
    expect(r.events).toEqual([]);
  });
  it("ranks an exact prefix match before a substring match", () => {
    const things = [
      thing({ id: "a", title: "Sunset Jazz Sessions" }),
      thing({ id: "b", title: "Jazz Night at SOhO" }),
    ];
    const r = searchThings({ query: "jazz", things, venueNames: {} });
    expect(r.events.map((h) => h.id)).toEqual(["b", "a"]);
  });
  it("breaks ties by soonest starts_at, undated last", () => {
    const things = [
      thing({ id: "later", title: "Jazz Night", starts_at: "2026-08-01T00:00:00Z" }),
      thing({ id: "soon", title: "Jazz Night", starts_at: "2026-07-15T00:00:00Z" }),
      thing({ id: "undated", title: "Jazz Night", starts_at: null }),
    ];
    const r = searchThings({ query: "jazz night", things, venueNames: {} });
    expect(r.events.map((h) => h.id)).toEqual(["soon", "later", "undated"]);
  });
  it("caps at 5 and reports the overflow", () => {
    const things = Array.from({ length: 8 }, (_, i) => thing({ id: `e${i}`, title: `Jazz ${i}` }));
    const r = searchThings({ query: "jazz", things, venueNames: {} });
    expect(r.events).toHaveLength(5);
    expect(r.eventsOverflow).toBe(3);
  });
  it("routes to the thing detail page", () => {
    const r = searchThings({ query: "jazz", things: [thing({ id: "z", title: "Jazz Night" })], venueNames: {} });
    expect(r.events[0].href).toBe("/thing/z");
  });
});

describe("searchThings, venues", () => {
  it("matches a venue name unrelated to any thing's title", () => {
    const things = [thing({ id: "e1", title: "Molly Miller Trio", venue_id: "v1" })];
    const r = searchThings({ query: "soho", things, venueNames: { v1: "SOhO Music Club" } });
    expect(r.venues.map((h) => h.label)).toEqual(["SOhO Music Club"]);
  });
  it("ignores a venue with no published things", () => {
    const r = searchThings({ query: "soho", things: [], venueNames: { v1: "SOhO Music Club" } });
    expect(r.venues).toEqual([]);
  });
  it("routes to the venue's own place card over one of its dated events", () => {
    const things = [
      thing({ id: "event1", title: "Show at SOhO", type: "event", venue_id: "v1", starts_at: "2026-07-20T00:00:00Z" }),
      thing({ id: "place1", title: "SOhO Music Club", type: "place", venue_id: "v1" }),
    ];
    const r = searchThings({ query: "soho", things, venueNames: { v1: "SOhO Music Club" } });
    expect(r.venues[0].href).toBe("/thing/place1");
  });
  it("falls back to the soonest event when the venue has no place card", () => {
    const things = [
      thing({ id: "later", title: "Show A", type: "event", venue_id: "v1", starts_at: "2026-08-01T00:00:00Z" }),
      thing({ id: "soon", title: "Show B", type: "event", venue_id: "v1", starts_at: "2026-07-15T00:00:00Z" }),
    ];
    const r = searchThings({ query: "soho", things, venueNames: { v1: "SOhO Music Club" } });
    expect(r.venues[0].href).toBe("/thing/soon");
  });
});

describe("searchThings, tags", () => {
  it("matches an occasion label and returns a vibe filter", () => {
    const r = searchThings({ query: "date night", things: [], venueNames: {} });
    expect(r.tags).toContainEqual({ kind: "tag", id: "date_night", label: "Date Night", filter: { dimension: "vibe", key: "date_night" } });
  });
  it("matches a zone label and returns a place filter", () => {
    const r = searchThings({ query: "funk", things: [], venueNames: {} });
    expect(r.tags).toContainEqual({ kind: "tag", id: "funk_zone", label: "Funk Zone", filter: { dimension: "place", key: "funk_zone" } });
  });
});
