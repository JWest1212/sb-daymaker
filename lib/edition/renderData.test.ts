import { describe, it, expect } from "vitest";
import { blurbSourceFor, type ThingRow } from "./renderData";

function thing(over: Partial<ThingRow> = {}): ThingRow {
  return {
    title: "Sunset jazz on the Mesa",
    blurb: "The quartet plays the bluff until the sun gives up.",
    blurb_long: "Grab a spot on the grass an hour early. The quartet plays the bluff until the sun gives up, and the crowd always sticks around after.",
    local_note: null,
    reason_to_go: "A standing Friday tradition worth building a night around.",
    neighborhood: "Mesa",
    starts_at: "2026-07-10T18:00:00-07:00",
    happening_tier: 1,
    photo_attribution: null,
    recurring_schedules: null,
    ...over,
  };
}

describe("blurbSourceFor — per-slot blurb mapping", () => {
  it("hero prefers the longer blurb_long over the short blurb", () => {
    const t = thing();
    expect(blurbSourceFor("hero", t)).toBe(t.blurb_long);
  });
  it("hero falls back to the short blurb when blurb_long is missing", () => {
    const t = thing({ blurb_long: null });
    expect(blurbSourceFor("hero", t)).toBe(t.blurb);
  });
  it("secondary uses the short blurb, never blurb_long", () => {
    const t = thing();
    expect(blurbSourceFor("secondary", t)).toBe(t.blurb);
  });
  it("anchor uses reason_to_go, never blurb", () => {
    const t = thing();
    expect(blurbSourceFor("anchor", t)).toBe(t.reason_to_go);
  });
  it("nonevent uses blurb, falling back to reason_to_go", () => {
    expect(blurbSourceFor("nonevent", thing())).toBe(thing().blurb);
    expect(blurbSourceFor("nonevent", thing({ blurb: null }))).toBe(thing().reason_to_go);
  });
});
