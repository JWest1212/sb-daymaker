import { describe, it, expect } from "vitest";
import { tierScore, tierBreakdown, type TierInput } from "./tierScore";

// A fully-formed Tier-1 place: what-it-is, address, a real secret, a real photo,
// a resolved price, no daypart concern (no starts_at).
const FULL: TierInput = {
  type: "place",
  title: "The Courthouse Clock Tower",
  blurb: "The best free view in town, hand-painted ceilings on the way up.",
  reason_to_go: "Climb the tower for the whole city and the sea.",
  address: "1100 Anacapa St, Santa Barbara, CA",
  lat: 34.4225,
  lng: -119.7031,
  nearby_zone: "downtown",
  local_note: "Go just before closing to catch the light without the crowd.",
  photo_url: "https://example.com/tower.jpg",
  photo_source: "wikimedia",
  price_band: null,
  free: true,
};

describe("tierScore", () => {
  it("scores a complete entry as Tier 1", () => {
    expect(tierScore(FULL)).toBe(1);
  });

  it("demotes to Tier 2 when the secret/logistics fact is missing", () => {
    expect(tierScore({ ...FULL, local_note: null, practical_note: null })).toBe(2);
  });

  it("demotes to Tier 2 when the image is a bare placeholder", () => {
    expect(tierScore({ ...FULL, photo_url: null, photo_source: "placeholder", visual_kind: null })).toBe(2);
  });

  it("keeps Tier 1 when the image is an intentional motif", () => {
    expect(
      tierScore({ ...FULL, photo_url: null, photo_source: "motif", visual_kind: "motif" }),
    ).toBe(1);
  });

  it("demotes to Tier 2 when the price is unresolved", () => {
    expect(tierScore({ ...FULL, free: null, price_band: null, buy_url: null })).toBe(2);
  });

  it("hides (Tier 3) when there is no what-it-is sentence", () => {
    // A bare label, like "LOTG" or "Coast Village Pop-Up".
    expect(
      tierScore({ ...FULL, blurb: "LOTG", blurb_long: null, reason_to_go: null }),
    ).toBe(3);
  });

  it("hides (Tier 3) when there is no location at all", () => {
    expect(
      tierScore({ ...FULL, address: null, lat: null, lng: null, nearby_zone: null }),
    ).toBe(3);
  });

  it("treats an unknown ('other') zone as no location", () => {
    expect(
      tierScore({ ...FULL, address: null, lat: null, lng: null, nearby_zone: "other" }),
    ).toBe(3);
  });

  it("accepts a zone-only outdoor spot as a valid location", () => {
    // No street address, no coords, but a real coarse zone → not Tier 3.
    const zoneOnly = { ...FULL, address: null, lat: null, lng: null, nearby_zone: "mesa" };
    expect(tierScore(zoneOnly)).not.toBe(3);
  });

  it("cannot be Tier 1 when the copy contradicts the event daypart", () => {
    // A 9am event whose blurb calls it a "late-night" affair fails the daypart check.
    const morningEvent: TierInput = {
      ...FULL,
      type: "event",
      starts_at: "2026-08-01T16:00:00.000Z", // 9am Pacific
      blurb: "A late-night set that runs well past midnight downtown.",
      free: true,
    };
    expect(tierScore(morningEvent)).toBe(2);
    expect(tierBreakdown(morningEvent).daypartOk).toBe(false);
  });

  it("lets a ticketed event resolve price via its outbound link", () => {
    const ticketed: TierInput = {
      ...FULL,
      type: "event",
      starts_at: "2026-08-01T03:00:00.000Z", // 8pm Pacific, no daypart words in copy
      blurb: "A downtown show worth the ticket, doors an hour before.",
      local_note: "Street parking frees up two blocks east after 8.",
      free: null,
      price_band: null,
      buy_url: "https://axs.com/event/123",
    };
    expect(tierBreakdown(ticketed).price).toBe(true);
    expect(tierScore(ticketed)).toBe(1);
  });
});
