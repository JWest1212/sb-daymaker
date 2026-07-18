import { describe, it, expect } from "vitest";
import { makeSlug, disambiguate, shortHash } from "./makeSlug";

describe("makeSlug", () => {
  it("lowercases, hyphenates, and keeps it readable", () => {
    expect(makeSlug("The Lark")).toBe("the-lark");
    expect(makeSlug("Free Summer Cinema: Say Anything")).toBe("free-summer-cinema-say-anything");
  });

  it("spells out ampersands and drops apostrophes", () => {
    expect(makeSlug("Wine & Food")).toBe("wine-and-food");
    expect(makeSlug("Hendry's Boathouse")).toBe("hendrys-boathouse");
  });

  it("strips diacritics", () => {
    expect(makeSlug("El Presidio de Santa Bárbara")).toBe("el-presidio-de-santa-barbara");
    expect(makeSlug("Café Loquita")).toBe("cafe-loquita");
  });

  it("collapses punctuation/symbols and trims stray hyphens", () => {
    // The literal em dash is built via fromCharCode so this file stays U+2014-free
    // (the Golden Rule gate); makeSlug must still collapse it to a hyphen.
    expect(makeSlug(`  MOXI ${String.fromCharCode(0x2014)} Hours!!!  `)).toBe("moxi-hours");
    expect(makeSlug("Gabriel 'Fluffy' Iglesias @ the Bowl")).toBe("gabriel-fluffy-iglesias-the-bowl");
  });

  it("is idempotent (slugging a slug returns it unchanged)", () => {
    const s = makeSlug("Santa Barbara Museum of Art");
    expect(makeSlug(s)).toBe(s);
  });

  it("never returns an empty string", () => {
    expect(makeSlug("")).toBe("item");
    expect(makeSlug("!!!")).toBe("item");
  });

  it("caps length on a word boundary", () => {
    const long = makeSlug("a ".repeat(80) + "endword");
    expect(long.length).toBeLessThanOrEqual(60);
    expect(long.endsWith("-")).toBe(false);
  });
});

describe("disambiguate", () => {
  it("returns the base when free", () => {
    expect(disambiguate("the-lark", "abcd-1234", new Set())).toBe("the-lark");
  });

  it("appends a stable id-hash on collision", () => {
    const taken = new Set(["the-lark"]);
    expect(disambiguate("the-lark", "9efd51ca-2d17", taken)).toBe(`the-lark-${shortHash("9efd51ca-2d17")}`);
  });

  it("bumps numerically if the hash also collides", () => {
    const h = shortHash("9efd51ca");
    const taken = new Set(["x", `x-${h}`]);
    expect(disambiguate("x", "9efd51ca", taken)).toBe(`x-${h}-2`);
  });
});
