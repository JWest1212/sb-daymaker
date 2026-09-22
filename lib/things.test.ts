import { describe, it, expect } from "vitest";
import { dedupeByTitle, normalizeTitle, PUBLIC_STATUSES, type Thing } from "./things";

function thing(id: string, title: string, over: Partial<Thing> = {}): Thing {
  return {
    id,
    type: "event",
    status: "published",
    hero_eligible: true,
    is_civic: false,
    title,
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
    price_band: null,
    free: null,
    starts_at: null,
    ends_at: null,
    buy_url: null,
    quality_tier: 1,
    hours: null,
    verified_at: null,
    verified_by: null,
    last_confirmed: null,
    setting: null,
    practical_note: null,
    slug: null,
    updated_at: null,
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

describe("normalizeTitle (R1 W2.6)", () => {
  it("ignores case, punctuation and spacing", () => {
    expect(normalizeTitle("Recreation Swim | Oak Park Wading Pool")).toBe(
      normalizeTitle("recreation swim  -  oak park wading pool"),
    );
  });

  it("ignores a curly apostrophe, so one series is not two", () => {
    expect(normalizeTitle("Knit 'n' Needle")).toBe(normalizeTitle("Knit ’n’ Needle"));
  });

  it("keeps genuinely different titles apart", () => {
    expect(normalizeTitle("Chess Club")).not.toBe(normalizeTitle("Scrabble Club"));
  });
});

describe("dedupeByTitle (R1 W2.6)", () => {
  it("collapses a recurring series to one row, keeping the first", () => {
    // The audit's case: the nearby list showed the same title three times.
    const out = dedupeByTitle([
      thing("a", "Recreation Swim | Oak Park Wading Pool", { starts_at: "2026-09-22T18:00:00Z" }),
      thing("b", "Recreation Swim | Oak Park Wading Pool", { starts_at: "2026-09-23T18:00:00Z" }),
      thing("c", "Recreation Swim | Oak Park Wading Pool", { starts_at: "2026-09-24T18:00:00Z" }),
      thing("d", "Chess Club"),
    ]);
    expect(out.map((t) => t.id)).toEqual(["a", "d"]);
  });

  it("preserves the order it was given", () => {
    const out = dedupeByTitle([thing("x", "Zebra"), thing("y", "Apple"), thing("z", "Zebra")]);
    expect(out.map((t) => t.title)).toEqual(["Zebra", "Apple"]);
  });

  it("is a no-op when every title is distinct", () => {
    const rows = [thing("a", "One"), thing("b", "Two"), thing("c", "Three")];
    expect(dedupeByTitle(rows)).toHaveLength(3);
  });

  it("handles an empty list", () => {
    expect(dedupeByTitle([])).toEqual([]);
  });
});

describe("PUBLIC_STATUSES (R1 W1.1)", () => {
  it("is exactly published and archived", () => {
    // Widening this silently widens what /saved, a shared link and a guide can
    // resolve, so it is pinned.
    expect([...PUBLIC_STATUSES]).toEqual(["published", "archived"]);
  });
});
