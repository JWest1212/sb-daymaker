import { describe, it, expect } from "vitest";
import { eventJsonLd, localBusinessJsonLd, breadcrumbJsonLd, thingJsonLd, prune, type JsonLdThing } from "./jsonLd";

const EVENT: JsonLdThing = {
  id: "e1",
  slug: "fluffy-at-the-bowl",
  type: "event",
  title: "Gabriel Iglesias at the Santa Barbara Bowl",
  blurb: "The comedian brings his tour to the Bowl for one night.",
  blurb_long: null,
  reason_to_go: null,
  address: "1122 N Milpas St, Santa Barbara, CA 93103",
  lat: 34.43,
  lng: -119.69,
  neighborhood: "riviera",
  happening_category: "live_music",
  price_band: "$$$",
  free: false,
  buy_url: "https://www.axs.com/events/123",
  starts_at: "2026-08-01T03:00:00.000Z",
  ends_at: "2026-08-01T06:00:00.000Z",
  photo_url: "https://cdn.example.com/bowl.jpg",
  photo_source: "wikimedia",
  hours: null,
};

const PLACE: JsonLdThing = {
  id: "p1",
  slug: "the-lark",
  type: "place",
  title: "The Lark",
  blurb: "A Funk Zone restaurant with shared plates and a buzzing patio.",
  blurb_long: null,
  reason_to_go: null,
  address: "131 Anacapa St, Santa Barbara, CA 93101",
  lat: 34.414,
  lng: -119.69,
  neighborhood: "funk_zone",
  happening_category: "food_drink_spot",
  price_band: "$$$",
  free: false,
  buy_url: null,
  starts_at: null,
  ends_at: null,
  photo_url: "https://cdn.example.com/lark.jpg",
  photo_source: "owned",
  hours: [
    { dow: 3, open: "17:00", close: "22:00" },
    { dow: 4, open: "17:00", close: "22:00" },
  ],
};

describe("prune", () => {
  it("removes null, empty string, empty array/object", () => {
    expect(prune({ a: 1, b: null, c: "", d: [], e: {}, f: "x" })).toEqual({ a: 1, f: "x" });
  });
});

describe("eventJsonLd", () => {
  const j = eventJsonLd(EVENT, "https://www.sbdaymaker.com/thing/fluffy-at-the-bowl");
  it("has the required Event fields with ISO dates", () => {
    expect(j["@type"]).toBe("Event");
    expect(j.name).toBe(EVENT.title);
    expect(j.startDate).toBe("2026-08-01T03:00:00.000Z");
    expect(j.endDate).toBe("2026-08-01T06:00:00.000Z");
    expect(() => new Date(j.startDate as string).toISOString()).not.toThrow();
  });
  it("has a Place location with a PostalAddress", () => {
    const loc = j.location as Record<string, unknown>;
    expect(loc["@type"]).toBe("Place");
    expect((loc.address as Record<string, unknown>)["@type"]).toBe("PostalAddress");
    expect((loc.address as Record<string, unknown>).addressLocality).toBe("Santa Barbara");
  });
  it("has an Offer pointing at the ticket URL", () => {
    const offer = j.offers as Record<string, unknown>;
    expect(offer.url).toBe("https://www.axs.com/events/123");
    expect(offer.availability).toBe("https://schema.org/InStock");
  });
});

describe("localBusinessJsonLd", () => {
  const j = localBusinessJsonLd(PLACE, "https://www.sbdaymaker.com/thing/the-lark");
  it("uses the Restaurant subtype for food_drink_spot", () => {
    expect(j["@type"]).toBe("Restaurant");
  });
  it("includes address, geo, priceRange, and hours", () => {
    expect((j.address as Record<string, unknown>)["@type"]).toBe("PostalAddress");
    expect((j.geo as Record<string, unknown>).latitude).toBe(34.414);
    expect(j.priceRange).toBe("$$$");
    const hours = j.openingHoursSpecification as Record<string, unknown>[];
    expect(hours).toHaveLength(2);
    expect(hours[0].dayOfWeek).toBe("https://schema.org/Wednesday");
    expect(hours[0].opens).toBe("17:00");
  });
});

describe("breadcrumbJsonLd", () => {
  it("emits absolute URLs and ordered positions", () => {
    const j = breadcrumbJsonLd([
      { name: "SB Daymaker", path: "/" },
      { name: "The Lark", path: "/thing/the-lark" },
    ]);
    const items = j.itemListElement as Record<string, unknown>[];
    expect(items[0].position).toBe(1);
    expect(items[1].item).toMatch(/^https?:\/\/.+\/thing\/the-lark$/);
  });
});

describe("thingJsonLd", () => {
  it("returns [Event, Breadcrumb] for an event and [LocalBusiness, Breadcrumb] for a place", () => {
    const ev = thingJsonLd(EVENT, "https://x/thing/fluffy-at-the-bowl", "/thing/fluffy-at-the-bowl");
    expect((ev[0] as Record<string, unknown>)["@type"]).toBe("Event");
    expect((ev[1] as Record<string, unknown>)["@type"]).toBe("BreadcrumbList");
    const pl = thingJsonLd(PLACE, "https://x/thing/the-lark", "/thing/the-lark");
    expect((pl[0] as Record<string, unknown>)["@type"]).toBe("Restaurant");
  });
});
