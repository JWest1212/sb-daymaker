import { describe, it, expect } from "vitest";
import {
  shortGuideTitle,
  parseGuideContent,
  deriveStopSub,
  directionsUrl,
  type StopThingFields,
} from "./guides";

// ─── parseGuideContent (empty / full / malformed) ───────────────────────────

describe("parseGuideContent", () => {
  it("empty {} → all-empty defaults (renders a plain v1 guide)", () => {
    expect(parseGuideContent({})).toEqual({
      meta: { distance_mi: null, plan_hrs: [] },
      chapters: [],
      asides: [],
      take: { h: null, items: [], landing: null },
      know_before: [],
      postcard_captions: {},
      secret_tease: null,
      sketch: { kind: "sketch", asset: null, no: null },
    });
  });

  it("the Funk Zone content (paper §A3) round-trips; unknown keys ignored", () => {
    const raw = {
      meta: { distance_mi: 1.3, plan_hrs: [3, 5] },
      chapters: [
        {
          k: "Stops 1–3 · Morning",
          name: "Pastry, science, murals",
          sum: "The zone before the crowds — start with the croissant.",
          tod: "morning",
        },
      ],
      asides: [{ after_chapter: 2, text: "Come Sunday before noon." }],
      take: {
        h: "Best bite in the zone, ranked.",
        items: [{ b: "The clam pie", rest: " at Lucky Penny — order it." }],
        landing: "Disagree? Good.",
      },
      know_before: [{ k: "Parking", v: "Lot on Yanonali." }],
      postcard_captions: { b1_3: "Off and walking.", b9: "Every stop." },
      secret_tease: "One detail is wrong on purpose.",
      sketch: { kind: "sketch", asset: "funk-zone", no: 1 },
      surprise_extra_key: "ignored",
    };
    expect(parseGuideContent(raw)).toEqual({
      meta: { distance_mi: 1.3, plan_hrs: [3, 5] },
      chapters: [
        {
          k: "Stops 1–3 · Morning",
          name: "Pastry, science, murals",
          sum: "The zone before the crowds — start with the croissant.",
          tod: "morning",
        },
      ],
      asides: [{ after_chapter: 2, text: "Come Sunday before noon." }],
      take: {
        h: "Best bite in the zone, ranked.",
        items: [{ b: "The clam pie", rest: " at Lucky Penny — order it." }],
        landing: "Disagree? Good.",
      },
      know_before: [{ k: "Parking", v: "Lot on Yanonali." }],
      postcard_captions: { b1_3: "Off and walking.", b9: "Every stop." },
      secret_tease: "One detail is wrong on purpose.",
      sketch: { kind: "sketch", asset: "funk-zone", no: 1 },
    });
  });

  it("emblem sketch kind is preserved; theme guides use it", () => {
    expect(parseGuideContent({ sketch: { kind: "emblem", asset: "rainy-day" } }).sketch).toEqual(
      { kind: "emblem", asset: "rainy-day", no: null },
    );
  });

  it("malformed / wrong-typed input never throws — coerces to defaults", () => {
    expect(parseGuideContent(null)).toEqual(parseGuideContent({}));
    expect(parseGuideContent("nope")).toEqual(parseGuideContent({}));
    expect(parseGuideContent(42)).toEqual(parseGuideContent({}));
    expect(parseGuideContent([1, 2, 3])).toEqual(parseGuideContent({}));

    const messy = parseGuideContent({
      meta: "not-an-object",
      chapters: "not-an-array",
      asides: [null, 5, { after_chapter: "x", text: 9 }],
      take: { h: 7, items: "nope", landing: null },
      know_before: [{ k: "ok", v: 5 }, "junk"],
      postcard_captions: { b1_3: "keep", b9: 5 },
      sketch: [],
    });
    expect(messy.meta).toEqual({ distance_mi: null, plan_hrs: [] });
    expect(messy.chapters).toEqual([]);
    // non-object entries dropped; wrong-typed fields coerced to null
    expect(messy.asides).toEqual([{ after_chapter: null, text: null }]);
    expect(messy.take).toEqual({ h: null, items: [], landing: null });
    expect(messy.know_before).toEqual([{ k: "ok", v: null }]);
    expect(messy.postcard_captions).toEqual({ b1_3: "keep" });
    expect(messy.sketch).toEqual({ kind: "sketch", asset: null, no: null });
  });

  it("unrecognized chapter tod coerces to null (golden is valid)", () => {
    const c = parseGuideContent({
      chapters: [{ k: null, name: null, sum: null, tod: "golden" }, { tod: "brunch" }],
    }).chapters;
    expect(c[0].tod).toBe("golden");
    expect(c[1].tod).toBeNull();
  });
});

// ─── deriveStopSub (five cases from spec §3.2) ──────────────────────────────

const fullThing: StopThingFields = {
  address: "1112 State St, Santa Barbara, CA",
  category: "food",
  price_band: "$$",
  free: false,
  lat: 34.42,
  lng: -119.7,
};

describe("deriveStopSub", () => {
  it("full thing → street · category · price", () => {
    expect(deriveStopSub({ thing_id: "t1", sub: null }, fullThing)).toBe(
      "State St · food · $$",
    );
  });

  it("thing with null category → omits the category segment", () => {
    expect(
      deriveStopSub({ thing_id: "t1", sub: null }, { ...fullThing, category: null }),
    ).toBe("State St · $$");
  });

  it("thing with null address → omits the street segment", () => {
    expect(
      deriveStopSub({ thing_id: "t1", sub: null }, { ...fullThing, address: null }),
    ).toBe("food · $$");
  });

  it("free thing → price glyph reads 'Free'", () => {
    expect(
      deriveStopSub(
        { thing_id: "t1", sub: null },
        { ...fullThing, price_band: "free", free: true },
      ),
    ).toBe("State St · food · Free");
  });

  it("label-only stop with a stored sub → returns it verbatim", () => {
    expect(deriveStopSub({ thing_id: null, sub: "Meet at the fountain" }, null)).toBe(
      "Meet at the fountain",
    );
  });

  it("label-only stop without a sub → null (card renders sub-less)", () => {
    expect(deriveStopSub({ thing_id: null, sub: null }, null)).toBeNull();
  });
});

// ─── directionsUrl (three branches from spec §3.3) ──────────────────────────

describe("directionsUrl", () => {
  it("maps_query set → encoded text-query link", () => {
    expect(
      directionsUrl({ maps_query: "Lucky Penny, Santa Barbara" }, null),
    ).toBe("https://maps.google.com/?q=Lucky%20Penny%2C%20Santa%20Barbara");
  });

  it("no query, thing lat/lng → coordinate link", () => {
    expect(directionsUrl({ maps_query: null }, { lat: 34.42, lng: -119.7 })).toBe(
      "https://maps.google.com/?q=34.42,-119.7",
    );
  });

  it("no query and no coords → null (no ⌖ link)", () => {
    expect(directionsUrl({ maps_query: null }, null)).toBeNull();
    expect(directionsUrl({ maps_query: null }, { lat: null, lng: null })).toBeNull();
  });
});

// ─── shortGuideTitle (Guide2 spec §1/§8.5) ──────────────────────────────────

describe("shortGuideTitle", () => {
  it("strips a trailing parenthetical qualifier", () => {
    expect(shortGuideTitle("State Street (First-timer)")).toBe("State Street");
  });

  it("no-op for a title with no trailing parenthetical", () => {
    expect(shortGuideTitle("The Funk Zone")).toBe("The Funk Zone");
  });
});
