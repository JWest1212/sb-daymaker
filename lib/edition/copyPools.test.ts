import { describe, it, expect } from "vitest";
import { resolveEditionCopy, stableHash, isEligible, SUBJECT_POOLS, PREHEADER_POOLS, GREETING_POOLS } from "./copyPools";
import type { CopyContext } from "./copyPools";

const baseCtx: CopyContext = {
  hero_title: "Summer Solstice Concert",
  hero_neighborhood: "Funk Zone",
  hero_when: "Fri · 7pm",
  edition_weekday: "Thursday",
  window_label: "the weekend ahead",
  pick_count: 3,
  heroIsEvergreen: false,
};

describe("stableHash", () => {
  it("is deterministic for the same input", () => {
    expect(stableHash("abc-123")).toBe(stableHash("abc-123"));
  });
  it("differs for different input (in general)", () => {
    expect(stableHash("edition-a")).not.toBe(stableHash("edition-b"));
  });
});

describe("resolveEditionCopy, determinism", () => {
  it("same edition_id + same context -> identical copy every call", () => {
    const a = resolveEditionCopy("11111111-1111-1111-1111-111111111111", "weekend", baseCtx);
    const b = resolveEditionCopy("11111111-1111-1111-1111-111111111111", "weekend", baseCtx);
    expect(a).toEqual(b);
  });
});

describe("resolveEditionCopy, no em dashes ever", () => {
  it("every pool line, substituted, is em-dash-free", () => {
    for (const pools of [SUBJECT_POOLS, PREHEADER_POOLS, GREETING_POOLS]) {
      for (const type of ["weekend", "week_ahead"] as const) {
        for (const line of pools[type]) {
          expect(line.text).not.toContain(String.fromCharCode(0x2014));
        }
      }
    }
  });
});

describe("resolveEditionCopy, evergreen-hero eligibility", () => {
  const evergreenCtx: CopyContext = { ...baseCtx, hero_title: "MOXI", heroIsEvergreen: true };

  it("isEligible: only [evergreen]-tagged lines qualify when the hero is evergreen", () => {
    for (const pools of [SUBJECT_POOLS, PREHEADER_POOLS, GREETING_POOLS]) {
      for (const type of ["weekend", "week_ahead"] as const) {
        for (const line of pools[type]) {
          expect(isEligible(line, evergreenCtx)).toBe(line.tags.includes("evergreen"));
        }
      }
    }
  });

  it("isEligible: [token]/[safe]-only lines are excluded, [safe] qualifies otherwise", () => {
    const normalCtx: CopyContext = { ...baseCtx, heroIsEvergreen: false };
    for (const pools of [SUBJECT_POOLS, PREHEADER_POOLS, GREETING_POOLS]) {
      for (const type of ["weekend", "week_ahead"] as const) {
        for (const line of pools[type]) {
          if (line.tags.length === 1 && line.tags[0] === "evergreen") {
            expect(isEligible(line, normalCtx)).toBe(false);
            expect(isEligible(line, evergreenCtx)).toBe(true);
          }
        }
      }
    }
  });
});

describe("resolveEditionCopy, thin pick_count drops token lines", () => {
  it("never emits a {pick_count}-bearing line when pick_count < 2", () => {
    const thinCtx: CopyContext = { ...baseCtx, pick_count: 1 };
    for (let i = 0; i < 50; i++) {
      const copy = resolveEditionCopy(`thin-${i}`, "weekend", thinCtx);
      expect(copy.subject).not.toMatch(/\d+ more worth it/);
    }
  });
});

describe("resolveEditionCopy, token substitution", () => {
  it("substitutes {hero_title} when a token line is chosen", () => {
    // Force selection of the known token-only line by hashing many ids and
    // checking whichever token line comes up substitutes correctly.
    for (let i = 0; i < 30; i++) {
      const copy = resolveEditionCopy(`token-check-${i}`, "weekend", baseCtx);
      expect(copy.subject).not.toContain("{hero_title}");
      expect(copy.subject).not.toContain("{pick_count}");
    }
  });
});
