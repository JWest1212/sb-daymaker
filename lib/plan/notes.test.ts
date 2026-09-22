import { describe, it, expect } from "vitest";
import { reduceNotes, noteKey, noteKeys, emptyBlockText, MIN_VIABLE_STOPS } from "./notes";
import type { PlanNote } from "./types";

const ctx = (over: Partial<Parameters<typeof reduceNotes>[1]> = {}) => ({
  stopCount: 3,
  meals: [] as never[],
  emptyBlocks: [] as never[],
  ...over,
});

describe("reduceNotes (R1 W3.2)", () => {
  it("collapses two wordings of the same missing meal into one sentence", () => {
    // The real case: meals.ts and validate.ts both report a missing lunch in
    // different words, and the old de-dupe compared exact strings so both showed.
    const raw: PlanNote[] = [
      { kind: "meal_unfilled", key: noteKeys.meal("lunch"), text: "We couldn't find an open lunch spot in your area and budget. Add one you like, or widen the plan." },
      { kind: "meal_unfilled", key: noteKeys.meal("lunch"), text: "No lunch stop yet. Add one so the day has a meal at mealtime." },
    ];
    const out = reduceNotes(raw, ctx());
    expect(out).toHaveLength(1);
    // The more informative one wins, because it was reported first.
    expect(out[0].text).toContain("in your area and budget");
  });

  it("keeps notes about DIFFERENT meals separate", () => {
    const raw: PlanNote[] = [
      { kind: "meal_unfilled", key: noteKeys.meal("lunch"), text: "no lunch" },
      { kind: "meal_unfilled", key: noteKeys.meal("dinner"), text: "no dinner" },
    ];
    expect(reduceNotes(raw, ctx())).toHaveLength(2);
  });

  it("adds a thin-day note when the draft has fewer than two stops", () => {
    const out = reduceNotes([], ctx({ stopCount: 1 }));
    expect(out.map((n) => n.kind)).toContain("thin_day");
    expect(out[0].kind).toBe("thin_day"); // stated first
  });

  it("does not call an empty draft thin: that is a different situation", () => {
    // Zero stops means the visitor started blank or cleared it, which the UI
    // already communicates; a "we could only fill one stop" note would be a lie.
    expect(reduceNotes([], ctx({ stopCount: 0 })).some((n) => n.kind === "thin_day")).toBe(false);
  });

  it("does not add a thin-day note to a viable day", () => {
    expect(reduceNotes([], ctx({ stopCount: MIN_VIABLE_STOPS })).some((n) => n.kind === "thin_day")).toBe(false);
  });

  it("orders notes by what the reader most needs", () => {
    const raw: PlanNote[] = [
      { kind: "cluster", text: "cluster" },
      { kind: "budget", text: "budget" },
      { kind: "meal_unfilled", key: noteKeys.meal("lunch"), text: "lunch" },
    ];
    const out = reduceNotes(raw, ctx({ stopCount: 1 }));
    expect(out.map((n) => n.kind)).toEqual(["thin_day", "meal_unfilled", "budget", "cluster"]);
  });

  it("reports an exhausted pool once", () => {
    const out = reduceNotes([], ctx({ noAlternatives: true }));
    expect(out.filter((n) => n.key === "no_alternatives")).toHaveLength(1);
  });

  it("falls back to kind and text when a note carries no key", () => {
    const a: PlanNote = { kind: "cluster", text: "same" };
    expect(noteKey(a)).toBe("cluster:same");
    expect(reduceNotes([a, { ...a }], ctx())).toHaveLength(1);
  });
});

describe("emptyBlockText (R1 W3.2)", () => {
  it("names the block and offers a way out", () => {
    expect(emptyBlockText("afternoon")).toBe(
      "Nothing found for afternoon yet. Add a stop or widen the plan.",
    );
  });

  it("uses the renamed evening label, not 'night'", () => {
    // R1 W3.6: the site says Evening everywhere else.
    expect(emptyBlockText("night")).toContain("evening");
  });
});
