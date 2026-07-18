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

describe("searchThings, tags (G3.2 re-synced vocabularies)", () => {
  const tags = (q: string) => searchThings({ query: q, things: [], venueNames: {} }).tags;
  const findTag = (q: string, label: string, door: string) =>
    tags(q).find((t) => t.label === label && t.door === door);

  it("matches an occasion label with the Occasion door + vibe filter", () => {
    const t = findTag("date night", "Date Night", "Occasion");
    expect(t).toMatchObject({ kind: "tag", door: "Occasion", filter: { dimension: "vibe", key: "date_night" } });
  });
  it("matches a place label with the Place door + place filter", () => {
    const t = findTag("funk", "Funk Zone", "Place");
    expect(t).toMatchObject({ kind: "tag", door: "Place", filter: { dimension: "place", key: "funk_zone" } });
  });
  it("matches an activity label with the Activity door + activity filter", () => {
    const t = findTag("live music", "Live music", "Activity");
    expect(t).toMatchObject({ kind: "tag", door: "Activity", filter: { dimension: "activity", key: "live-music" } });
  });

  it("Occasion vocabulary is exactly the 8 live labels (dog friendly in, stale out)", () => {
    const OCC_8 = ["Date Night", "Family Day", "Nightlife", "Hosting Visitors", "Solo", "Free in SB", "Rainy Day", "Dog Friendly"];
    for (const label of OCC_8) expect(findTag(label.toLowerCase(), label, "Occasion")).toBeTruthy();
    // The four labels that moved to the Activity door are gone from Occasion.
    for (const stale of ["Wine & Food", "Catch a Show", "Arts & Culture", "Outdoors & Active"]) {
      expect(tags(stale.toLowerCase()).some((t) => t.door === "Occasion" && t.label === stale)).toBe(false);
    }
  });
  it("Place vocabulary is the 8 door zones", () => {
    const PLACE_8 = ["Downtown & State Street", "Funk Zone", "Waterfront & Harbor", "The Mesa", "Mission & Riviera", "Uptown & Upper State", "Goleta & Isla Vista", "Montecito · Summerland · Carpinteria"];
    for (const label of PLACE_8) expect(findTag(label.toLowerCase(), label, "Place")).toBeTruthy();
  });
  it("Activity vocabulary is the 10 activities", () => {
    const ACT_10 = ["Live music", "Arts & galleries", "Food & drink", "Outdoors", "Markets", "Family & kids", "Film & talks", "Wellness & fitness", "Nightlife", "Community & Festivals"];
    for (const label of ACT_10) expect(findTag(label.toLowerCase(), label, "Activity")).toBeTruthy();
  });

  it("returns two door-labeled rows for an overlapping label (Nightlife)", () => {
    const nl = tags("nightlife").filter((t) => t.label === "Nightlife");
    expect(nl).toHaveLength(2);
    expect(nl.map((t) => t.door).sort()).toEqual(["Activity", "Occasion"]);
    expect(nl.map((t) => t.filter?.dimension).sort()).toEqual(["activity", "vibe"]);
  });
});

describe("searchThings, G3.2 event neighborhood/zone match", () => {
  it("returns things in a zone even when the title lacks the word", () => {
    const things = [thing({ id: "z", title: "Molly Miller Trio", neighborhood: "funk_zone" })];
    const r = searchThings({ query: "funk zone", things, venueNames: {} });
    expect(r.events.map((h) => h.id)).toContain("z");
  });
  it("ranks a title hit above a zone-only hit at the same tier", () => {
    const things = [
      thing({ id: "zoneonly", title: "Molly Miller Trio", neighborhood: "funk_zone" }),
      thing({ id: "titlehit", title: "Funk Zone Block Party" }),
    ];
    const r = searchThings({ query: "funk zone", things, venueNames: {} });
    expect(r.events[0].id).toBe("titlehit");
  });
});

describe("searchThings, G3.2 fuzzy typo tolerance", () => {
  it("matches 'loqita' to a 'Loquita' title (fuzzy)", () => {
    const r = searchThings({ query: "loqita", things: [thing({ id: "l", title: "Loquita" })], venueNames: {} });
    expect(r.events.map((h) => h.id)).toContain("l");
  });
  it("ranks an exact/prefix hit ABOVE a fuzzy hit", () => {
    const things = [
      thing({ id: "fuzzy", title: "Jozz Fest" }), // 'jozz' is edit-distance 1 from 'jazz'
      thing({ id: "exact", title: "Jazz Night" }), // prefix match
    ];
    const r = searchThings({ query: "jazz", things, venueNames: {} });
    expect(r.events[0].id).toBe("exact");
    expect(r.events.map((h) => h.id)).toContain("fuzzy");
  });
  it("a fuzzy hit never displaces an exact venue match", () => {
    const things = [thing({ id: "e", title: "Show", venue_id: "v1" })];
    const r = searchThings({ query: "loqita", things, venueNames: { v1: "Loquita" } });
    expect(r.venues.map((h) => h.label)).toContain("Loquita");
  });
});

describe("searchThings, G3.2 slug links", () => {
  it("links events to the slug when present", () => {
    const r = searchThings({ query: "jazz", things: [thing({ id: "u", slug: "jazz-night", title: "Jazz Night" })], venueNames: {} });
    expect(r.events[0].href).toBe("/thing/jazz-night");
  });
  it("falls back to the id when no slug yet", () => {
    const r = searchThings({ query: "jazz", things: [thing({ id: "u", slug: null, title: "Jazz Night" })], venueNames: {} });
    expect(r.events[0].href).toBe("/thing/u");
  });
});
