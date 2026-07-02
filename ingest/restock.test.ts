import { describe, it, expect } from "vitest";
import { candidateMatchesScope } from "./restock";
import type { Candidate } from "../packages/shared/types";

const cand = (p: Partial<Candidate>): Candidate => p as Candidate;

describe("candidateMatchesScope", () => {
  it("matches a vibe by proposed tag", () => {
    const c = cand({ proposed_tags: [{ tag: "date_night", confidence: 0.9 }] });
    expect(candidateMatchesScope(c, "vibe", "date_night")).toBe(true);
    expect(candidateMatchesScope(c, "vibe", "family_day")).toBe(false);
  });

  it("matches a zone by coordinates (nearest anchor)", () => {
    const downtown = cand({ lat: 34.4208, lng: -119.6982 }); // downtown anchor
    expect(candidateMatchesScope(downtown, "zone", "downtown")).toBe(true);
    expect(candidateMatchesScope(downtown, "zone", "goleta")).toBe(false);
  });

  it("falls back to the neighborhood map when there are no coordinates", () => {
    const carp = cand({ neighborhood: "carpinteria" }); // -> montecito
    expect(candidateMatchesScope(carp, "zone", "montecito")).toBe(true);
    const riviera = cand({ neighborhood: "riviera" }); // -> downtown
    expect(candidateMatchesScope(riviera, "zone", "downtown")).toBe(true);
  });

  it("does not match a zone with no coords and no mappable neighborhood", () => {
    expect(candidateMatchesScope(cand({ neighborhood: "other" }), "zone", "downtown")).toBe(false);
    expect(candidateMatchesScope(cand({}), "zone", "downtown")).toBe(false);
  });

  it("returns false for an unknown scope kind", () => {
    expect(candidateMatchesScope(cand({ proposed_tags: [{ tag: "solo", confidence: 1 }] }), "bogus", "solo")).toBe(false);
  });
});
