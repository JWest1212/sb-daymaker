import { describe, it, expect } from "vitest";
import { isGrayDay, worksIndoors, heroEyebrow } from "./derive";
import type { Thing } from "@/lib/things";
import type { Weather } from "@/lib/weather";
import { thing } from "@/lib/plan/_fixture";

const weather = (condition: string, description: string, isClear = false): Weather => ({
  tempF: 74,
  condition,
  description,
  icon: "02d",
  isClear,
});

describe("isGrayDay (R1 W2.5, TP-C8-03)", () => {
  it("is not gray on the audit's observed input, a partly cloudy 74", () => {
    // This is the regression: "⛅ 74°" was being called a gray day, which then
    // pre-empted every other eyebrow.
    expect(isGrayDay(weather("Clouds", "few clouds"))).toBe(false);
    expect(isGrayDay(weather("Clouds", "scattered clouds"))).toBe(false);
    expect(isGrayDay(weather("Clouds", "partly cloudy"))).toBe(false);
  });

  it("is gray under heavy cloud", () => {
    expect(isGrayDay(weather("Clouds", "overcast clouds"))).toBe(true);
    expect(isGrayDay(weather("Clouds", "broken clouds"))).toBe(true);
  });

  it("is gray in rain, fog and their relatives", () => {
    for (const c of ["Rain", "Drizzle", "Thunderstorm", "Snow", "Fog", "Mist", "Haze"]) {
      expect(isGrayDay(weather(c, c.toLowerCase())), c).toBe(true);
    }
  });

  it("is never gray when the sky is clear", () => {
    expect(isGrayDay(weather("Clear", "clear sky", true))).toBe(false);
  });

  it("is not gray when there is no weather at all", () => {
    expect(isGrayDay(null)).toBe(false);
  });

  it("does not claim gray when the description says nothing useful", () => {
    // Overclaiming is the failure being fixed, so an unknown cloud description
    // resolves to "not gray" rather than "gray".
    expect(isGrayDay(weather("Clouds", ""))).toBe(false);
  });
});

describe("worksIndoors (R1 W2.5)", () => {
  it("prefers the richer setting field over the indoor bit", () => {
    expect(worksIndoors(thing({ setting: "indoor", indoor: false }))).toBe(true);
    expect(worksIndoors(thing({ setting: "outdoor", indoor: true }))).toBe(false);
  });

  it("counts 'both' as indoor-capable", () => {
    expect(worksIndoors(thing({ setting: "both" }))).toBe(true);
  });

  it("falls back to the indoor bit when setting is unset", () => {
    expect(worksIndoors(thing({ setting: null, indoor: true }))).toBe(true);
    expect(worksIndoors(thing({ setting: null, indoor: false }))).toBe(false);
  });
});

describe("heroEyebrow (R1 W2.5)", () => {
  const indoorEvent = (over: Partial<Thing> = {}) =>
    thing({ type: "event", setting: "indoor", happening_category: "live_music", ...over });

  it("does not say 'Gray day move' on a partly cloudy day", () => {
    expect(heroEyebrow(indoorEvent(), isGrayDay(weather("Clouds", "partly cloudy")))).not.toBe("Gray day move");
  });

  it("says 'Gray day move' when it really is gray and the pick is indoors", () => {
    expect(heroEyebrow(indoorEvent(), isGrayDay(weather("Rain", "light rain")))).toBe("Gray day move");
  });

  it("never calls an outdoor pick a gray day move, even in the rain", () => {
    // Recommending an outdoor thing as the wet-weather answer is worse than
    // saying nothing.
    const outdoor = thing({ type: "event", setting: "outdoor", happening_category: "live_music" });
    expect(heroEyebrow(outdoor, isGrayDay(weather("Rain", "heavy rain")))).toBe("Catch a Show");
  });

  it("falls through to the content branches when it is not gray", () => {
    expect(heroEyebrow(thing({ type: "place", setting: "indoor" }), false)).toBe("Local favorite");
    expect(heroEyebrow(indoorEvent({ free: true }), false)).toBe("Free");
    expect(heroEyebrow(indoorEvent(), false)).toBe("Catch a Show");
  });
});
