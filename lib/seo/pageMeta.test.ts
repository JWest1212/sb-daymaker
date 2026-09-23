import { describe, it, expect } from "vitest";
import { pageMeta } from "./pageMeta";

// R1 W7.8 (META-001). Every page writes its own openGraph, so none inherits
// the root layout's bare "SB Daymaker".
describe("pageMeta", () => {
  const m = pageMeta({ title: "Your Saved List · SB Daymaker", description: "d", path: "/saved" });
  it("writes the page's own og:title, without repeating the site name", () => {
    expect(m.openGraph?.title).toBe("Your Saved List");
    expect((m.openGraph as { siteName?: string }).siteName).toBe("SB Daymaker");
  });
  it("sets canonical and og:url from the path", () => {
    expect(m.alternates?.canonical).toBe("/saved");
    expect((m.openGraph as { url?: string }).url).toBe("/saved");
  });
  it("token pages get noindex and no canonical", () => {
    const t = pageMeta({ title: "Shared picks · SB Daymaker", description: "d", noindex: true });
    expect(t.alternates).toBeUndefined();
    expect(t.robots).toEqual({ index: false, follow: false });
  });
});
