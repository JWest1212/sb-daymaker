import { describe, it, expect } from "vitest";
import { parseHorizon, parseArea, parseOccasion, parseActivity, exploreQuery, parseExploreState, PARAM } from "./exploreParams";

describe("URL parsers are total (R1 W6.1)", () => {
  it("reads every locked horizon", () => {
    for (const h of ["today", "tomorrow", "weekend", "next_weekend", "week", "month"]) {
      expect(parseHorizon(h)).toBe(h);
    }
  });

  it("falls back to today for anything it does not recognise", () => {
    // A URL is untrusted input: people edit, truncate and mangle them in chat
    // apps. Every parser has to survive that rather than throw.
    for (const bad of ["yesterday", "", "  ", "TODAY", undefined, null, "../etc/passwd"]) {
      expect(parseHorizon(bad), String(bad)).toBe("today");
    }
  });

  it("accepts a real area and rejects anything else", () => {
    expect(parseArea("funk_zone")).toBe("funk_zone");
    expect(parseArea("atlantis")).toBeNull();
    expect(parseArea(null)).toBeNull();
    // Prototype-pollution shaped keys must not resolve.
    expect(parseArea("constructor")).toBeNull();
    expect(parseArea("__proto__")).toBeNull();
  });

  it("accepts a real occasion and activity, rejects the rest", () => {
    expect(parseOccasion("date_night")).toBe("date_night");
    expect(parseOccasion("nope")).toBeNull();
    expect(parseActivity("live-music")).toBe("live-music");
    expect(parseActivity("nope")).toBeNull();
  });
});

describe("exploreQuery (R1 W6.1)", () => {
  const base = { horizon: "today" as const, area: null, occasion: null, activity: null };

  it("keeps the plain homepage clean", () => {
    expect(exploreQuery(base)).toBe("");
  });

  it("carries only what was chosen", () => {
    expect(exploreQuery({ ...base, horizon: "weekend" })).toBe(`?${PARAM.when}=weekend`);
    expect(exploreQuery({ ...base, area: "funk_zone" })).toBe(`?${PARAM.area}=funk_zone`);
  });

  it("carries a full view", () => {
    const q = exploreQuery({ horizon: "weekend", area: "funk_zone", occasion: "nightlife", activity: "live-music" });
    expect(q).toContain("when=weekend");
    expect(q).toContain("area=funk_zone");
    expect(q).toContain("occasion=nightlife");
    expect(q).toContain("activity=live-music");
  });

  it("round-trips through the parser", () => {
    const state = { horizon: "next_weekend" as const, area: "mesa" as const, occasion: "date_night" as const, activity: null };
    const sp = new URLSearchParams(exploreQuery(state).slice(1));
    expect(parseExploreState((k) => sp.get(k))).toEqual(state);
  });
});
