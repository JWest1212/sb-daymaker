import { describe, it, expect } from "vitest";
import { sizedPhoto } from "./photoSize";

describe("sizedPhoto", () => {
  it("asks Google for the slot's width as WebP, replacing the stored size", () => {
    const g = "https://lh3.googleusercontent.com/place-photos/AG9NLjDss00268=s4800-w1152";
    expect(sizedPhoto(g, "rail")).toBe("https://lh3.googleusercontent.com/place-photos/AG9NLjDss00268=w320-rw");
    expect(sizedPhoto("https://lh5.googleusercontent.com/p/AF1Qip", "thumb")).toBe("https://lh5.googleusercontent.com/p/AF1Qip=w200-rw");
  });
  it("turns a Wikimedia original into a ladder-sized thumbnail", () => {
    const w = "https://upload.wikimedia.org/wikipedia/commons/d/df/1887_Etching.png";
    expect(sizedPhoto(w, "card")).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/1887_Etching.png/960px-1887_Etching.png");
  });
  it("re-sizes an existing Wikimedia thumbnail and drops tracking queries", () => {
    const w = "https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/SB_Downtown.jpg/1280px-SB_Downtown.jpg?utm_source=x";
    expect(sizedPhoto(w, "rail")).toBe("https://upload.wikimedia.org/wikipedia/commons/thumb/5/5f/SB_Downtown.jpg/330px-SB_Downtown.jpg");
  });
  it("leaves formats whose thumbnails change type, other hosts, and bad input alone", () => {
    const svg = "https://upload.wikimedia.org/wikipedia/commons/a/ab/Map.svg";
    expect(sizedPhoto(svg, "card")).toBe(svg);
    const s = "https://ruthptgwmleavpivylfc.supabase.co/storage/v1/object/public/edition-media/things/x.jpg";
    expect(sizedPhoto(s, "card")).toBe(s);
    expect(sizedPhoto(null, "card")).toBeNull();
    expect(sizedPhoto("not a url", "card")).toBe("not a url");
  });
});
