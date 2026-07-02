import { describe, it, expect } from "vitest";
import { shadeColumn, COVERAGE_FLOORS } from "./coverage";

describe("shadeColumn", () => {
  it("shades a zero cell red regardless of rank", () => {
    const s = shadeColumn([0, 1, 2], 7, false);
    expect(s[0].rag).toBe("r");
  });

  it("forces red under the absolute floor when floorOn", () => {
    // floor for 7d is 3; all cells at 2 are below it.
    expect(COVERAGE_FLOORS[7]).toBe(3);
    const on = shadeColumn([2, 2, 2], 7, true);
    expect(on.every((c) => c.rag === "r")).toBe(true);
    // floor off + all-equal non-zero -> relative shading reads them as green.
    const off = shadeColumn([2, 2, 2], 7, false);
    expect(off.every((c) => c.rag === "g")).toBe(true);
  });

  it("marks the column max green-deep and ranks the rest", () => {
    const s = shadeColumn([1, 5, 20], 45, false);
    expect(s[2]).toEqual({ rag: "g", deep: true }); // max
    expect(s[1].rag).toBe("g");
    expect(s[0].rag).toBe("a");
  });

  it("marks the column min red-deep", () => {
    const s = shadeColumn([0, 8, 12], 45, false);
    expect(s[0]).toEqual({ rag: "r", deep: true }); // min (and zero)
  });
});
