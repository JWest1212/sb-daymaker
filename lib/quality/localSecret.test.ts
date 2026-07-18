import { describe, it, expect } from "vitest";
import { isRealSecret } from "./localSecret";

describe("isRealSecret", () => {
  it("hides a secret that just restates the marketing blurb (the MOXI case)", () => {
    const blurb = "A hands-on science museum with a rooftop water deck overlooking the harbor.";
    expect(isRealSecret("Don't miss the rooftop water deck.", { blurb })).toBe(false);
  });

  it("keeps a genuinely distinct secret (the Iglesias parking case)", () => {
    const blurb = "Neighborhood taqueria known for its al pastor and horchata.";
    const secret = "Park on the side street behind the church, the front lot fills by noon.";
    expect(isRealSecret(secret, { blurb })).toBe(true);
  });

  it("hides an empty or trivially short note", () => {
    expect(isRealSecret(null, { blurb: "x" })).toBe(false);
    expect(isRealSecret("go early", { blurb: "x" })).toBe(false);
  });

  it("trusts the note when there is no marketing copy to compare", () => {
    expect(isRealSecret("Ask for the corner booth upstairs.", {})).toBe(true);
  });
});
