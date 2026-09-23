import { describe, it, expect } from "vitest";
import {
  AREAS, AREA_BY_KEY, AREA_CANONICAL_NEIGHBORHOOD, ANYWHERE_LABEL,
  areaForNeighborhood, areaForNearbyZone, areaForThing, areaLabelForThing,
  areaShortForThing, nearestArea, type AreaKey,
} from "./areas";
import { NEIGHBORHOOD_ZONE } from "./zones";

describe("the area vocabulary (R1 W4.1, D5)", () => {
  it("has exactly the eight public areas", () => {
    expect(AREAS).toHaveLength(8);
    expect(AREAS.map((a) => a.key)).toEqual([
      "downtown_state", "funk_zone", "waterfront_harbor", "mesa",
      "mission_riviera", "upper_state", "goleta_isla_vista", "montecito_carpinteria",
    ]);
  });

  it("uses the final labels verbatim", () => {
    expect(AREAS.map((a) => a.label)).toEqual([
      "Downtown and State Street",
      "Funk Zone",
      "Waterfront and Harbor",
      "The Mesa",
      "Mission and Riviera",
      "Upper State",
      "Goleta and Isla Vista",
      "Montecito, Summerland, and Carpinteria",
    ]);
  });

  it("spells labels with 'and', never an ampersand", () => {
    // One string that reads correctly aloud, in an email and in a chip.
    for (const a of AREAS) {
      expect(a.label, a.key).not.toContain("&");
      expect(a.short, a.key).not.toContain("&");
    }
  });

  it("gives every area a distinct label and short form", () => {
    expect(new Set(AREAS.map((a) => a.label)).size).toBe(8);
    expect(new Set(AREAS.map((a) => a.short)).size).toBe(8);
  });
});

describe("every neighborhood maps to exactly one area, or to null", () => {
  it("maps each known neighborhood to one area", () => {
    const seen = new Map<string, AreaKey>();
    for (const a of AREAS) {
      for (const n of a.neighborhoods) {
        expect(seen.has(n), `${n} mapped twice`).toBe(false);
        seen.set(n, a.key);
      }
    }
    // Every enum value the older module knew about is still accounted for.
    for (const n of Object.keys(NEIGHBORHOOD_ZONE)) {
      if (n === "other") continue;
      expect(areaForNeighborhood(n), n).not.toBeNull();
    }
  });

  it("treats 'other' as unknown, never as an area", () => {
    // "OTHER" on a card is the bug; unknown must render as nothing.
    expect(areaForNeighborhood("other")).toBeNull();
    expect(areaForNeighborhood(null)).toBeNull();
    expect(areaForNeighborhood(undefined)).toBeNull();
    expect(areaForNeighborhood("not_a_real_value")).toBeNull();
  });
});

describe("areaForThing resolution order (R1 W4.1)", () => {
  const t = (neighborhood: string | null, nearby_zone: string | null) =>
    ({ neighborhood, nearby_zone } as Parameters<typeof areaForThing>[0]);

  it("prefers neighborhood, the finer column", () => {
    expect(areaForThing(t("riviera", "downtown"))).toBe("mission_riviera");
    expect(areaForThing(t("upper_state", "downtown"))).toBe("upper_state");
  });

  it("falls back to nearby_zone when neighborhood is unknown", () => {
    expect(areaForThing(t(null, "funk"))).toBe("funk_zone");
    expect(areaForThing(t("other", "montecito"))).toBe("montecito_carpinteria");
  });

  it("returns null when neither column knows", () => {
    expect(areaForThing(t(null, null))).toBeNull();
    expect(areaForThing(t("other", null))).toBeNull();
  });

  it("never labels an unknown area", () => {
    expect(areaLabelForThing(t(null, null))).toBeNull();
    expect(areaShortForThing(t(null, null))).toBeNull();
  });

  it("resolves the two areas the old 6-value system could not express", () => {
    // Mission and Riviera and Upper State both folded into "downtown" before,
    // which is why nearby_zone alone cannot produce them.
    expect(areaForNearbyZone("downtown")).toBe("downtown_state");
    expect(AREA_BY_KEY.mission_riviera.nearbyZone).toBeNull();
    expect(AREA_BY_KEY.upper_state.nearbyZone).toBeNull();
  });
});

describe("nearestArea (R1 W4.4 rule 2)", () => {
  it("resolves each area's own centroid to itself", () => {
    for (const a of AREAS) expect(nearestArea(a.lat, a.lng), a.key).toBe(a.key);
  });

  it("puts a known Santa Barbara landmark in the right area", () => {
    // The Natural History Museum, 2559 Puesta del Sol (W4.5).
    expect(nearestArea(34.4416, -119.7096)).toBe("mission_riviera");
    // Stearns Wharf.
    expect(nearestArea(34.4103, -119.6858)).toBe("waterfront_harbor");
  });
});

describe("canonical neighborhood per area", () => {
  it("gives every area a storable neighborhood value that maps back to it", () => {
    for (const a of AREAS) {
      const n = AREA_CANONICAL_NEIGHBORHOOD[a.key];
      expect(n, a.key).toBeDefined();
      expect(areaForNeighborhood(n), `${a.key} round trip`).toBe(a.key);
    }
  });
});

describe("the shared 'anywhere' string", () => {
  it("is one string, so Plan and Saved cannot drift", () => {
    expect(ANYWHERE_LABEL).toBe("Anywhere in SB");
  });
});
