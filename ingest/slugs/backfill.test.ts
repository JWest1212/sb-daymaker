import { describe, it, expect } from "vitest";
import { planShortenings } from "./backfill";

// R1 W6.7 (DET-007). The audit's case: /thing/baby-and-me-808c, where nothing
// else claims "baby-and-me". A four-character hash in a URL a person is meant
// to read and trust has to be earning its place.

const row = (id: string, title: string, slug: string | null) => ({ id, title, slug });

describe("planShortenings", () => {
  it("drops a hash nobody is competing for", () => {
    expect(planShortenings([row("808c71a7-748d-5d3f-85a1-e197b937abdc", "Baby and Me", "baby-and-me-808c")]))
      .toEqual([{ id: "808c71a7-748d-5d3f-85a1-e197b937abdc", from: "baby-and-me-808c", to: "baby-and-me" }]);
  });

  it("keeps the hash while the bare slug is still taken", () => {
    const plan = planShortenings([
      row("808c71a7-748d-5d3f-85a1-e197b937abdc", "Baby and Me", "baby-and-me-808c"),
      row("aaaaaaaa-0000-0000-0000-000000000000", "Baby and Me", "baby-and-me"),
    ]);
    expect(plan).toEqual([]);
  });

  it("gives a freed base to exactly one of two hashed rivals, deterministically", () => {
    const rows = [
      row("ffff1111-0000-0000-0000-000000000000", "Baby and Me", "baby-and-me-ffff"),
      row("1111ffff-0000-0000-0000-000000000000", "Baby and Me", "baby-and-me-1111"),
    ];
    const plan = planShortenings(rows);
    expect(plan).toHaveLength(1);
    expect(plan[0].id).toBe("1111ffff-0000-0000-0000-000000000000"); // lowest id wins, every run
    // and running it again changes nothing further
    expect(planShortenings([row(plan[0].id, "Baby and Me", plan[0].to), rows[0]])).toEqual([]);
  });

  it("leaves alone a slug that merely ends in hex-looking characters", () => {
    // "Cafe Fresco" -> "cafe-fresco"; the tail is part of the title, not a hash.
    expect(planShortenings([row("abcd1234-0000-0000-0000-000000000000", "Cafe Fresco", "cafe-fresco")]))
      .toEqual([]);
  });

  it("leaves alone a hand-edited slug that is not what the generator would make", () => {
    expect(planShortenings([row("808c71a7-748d-5d3f-85a1-e197b937abdc", "Baby and Me", "mommy-and-me")]))
      .toEqual([]);
  });

  it("ignores rows with no slug yet (slugTable's job, not this one)", () => {
    expect(planShortenings([row("808c71a7-748d-5d3f-85a1-e197b937abdc", "Baby and Me", null)])).toEqual([]);
  });
});

// R1 W6.7. The live failure: `things_slug_uidx` is table-wide, so a slug held
// by a draft or rejected row is NOT free, even though that row is never served.
describe("planShortenings respects slugs outside the public statuses", () => {
  it("will not shorten into a base a non-public row is holding", () => {
    const plan = planShortenings(
      [{ id: "808c71a7-748d-5d3f-85a1-e197b937abdc", title: "Baby and Me", slug: "baby-and-me-808c" }],
      ["baby-and-me"], // a draft row has it
    );
    expect(plan).toEqual([]);
  });

  it("still shortens when the wider set does not claim the base", () => {
    const plan = planShortenings(
      [{ id: "808c71a7-748d-5d3f-85a1-e197b937abdc", title: "Baby and Me", slug: "baby-and-me-808c" }],
      ["something-else"],
    );
    expect(plan).toHaveLength(1);
  });
});
