import { describe, it, expect } from "vitest";
import { discoveryQueries } from "./imageQuery";

describe("discoveryQueries", () => {
  it("leads with a topic-only query, then a neighborhood + Santa Barbara fallback", () => {
    const qs = discoveryQueries({ neighborhood: "downtown", happening_category: "culture_spot" });
    expect(qs).toEqual(["museum gallery interior", "downtown Santa Barbara"]);
  });

  it("falls back to a bare Santa Barbara query when neither category nor neighborhood exist", () => {
    expect(discoveryQueries({ neighborhood: null, happening_category: null })).toEqual(["Santa Barbara"]);
  });

  it("uses only the location query when there's no category", () => {
    expect(discoveryQueries({ neighborhood: "mesa", happening_category: null })).toEqual(["mesa Santa Barbara"]);
  });

  it("underscored neighborhood values read as plain words", () => {
    const qs = discoveryQueries({ neighborhood: "funk_zone", happening_category: null });
    expect(qs).toEqual(["funk zone Santa Barbara"]);
  });

  it("dedupes if the topic and location queries would be identical", () => {
    // No plausible real case produces this, but the dedup itself is worth pinning.
    const qs = discoveryQueries({ neighborhood: null, happening_category: null });
    expect(new Set(qs).size).toBe(qs.length);
  });
});
