import { describe, it, expect } from "vitest";
import { renderEditionEmailHtml, renderEditionPlainText } from "./render";
import type { RenderableEdition, RenderPick } from "./render";

function pick(over: Partial<RenderPick> = {}): RenderPick {
  return {
    thingId: "t-1",
    title: "Sunset jazz on the Mesa",
    blurb: "The quartet plays the bluff until the sun gives up.",
    when: "FRI 6:00 PM",
    neighborhood: "Mesa",
    localNote: null,
    imageUrl: "https://images.example.com/photo.jpg",
    imageAttribution: null,
    dayLabel: null,
    href: "https://www.sbdaymaker.com/thing/t-1",
    ...over,
  };
}

function edition(over: Partial<RenderableEdition> = {}): RenderableEdition {
  return {
    editionType: "weekend",
    subject: "This weekend: Sunset jazz on the Mesa",
    preheader: "Our shortlist for the next three days.",
    greeting: "The Mesa is where we'd start this weekend.",
    windowLabel: "the weekend ahead",
    dateLabel: "Thu Jul 9",
    secondariesLabel: "Also this weekend",
    nonEventLabel: "New this week",
    hero: pick(),
    secondaries: [],
    nonEvent: null,
    anchor: null,
    permalinkUrl: "https://www.sbdaymaker.com/edition/2026-07-09",
    subscribeUrl: "https://www.sbdaymaker.com/",
    unsubscribeUrl: "https://www.sbdaymaker.com/unsubscribe?token=abc",
    ...over,
  };
}

describe("renderEditionEmailHtml — em-dash normalization", () => {
  it("strips an em dash from a reused title/blurb even though the drafter never wrote it", () => {
    const html = renderEditionEmailHtml(
      edition({ hero: pick({ title: "Karaoke Night — Dargan's", blurb: "Sing along — no cover." }) }),
    );
    expect(html).not.toContain("—");
  });

  it("subject/preheader/greeting are also normalized defensively", () => {
    const html = renderEditionEmailHtml(
      edition({ subject: "A — B", preheader: "C — D", greeting: "E — F" }),
    );
    expect(html).not.toContain("—");
  });
});

describe("renderEditionEmailHtml — HTML escaping", () => {
  it("escapes & and other HTML metacharacters in reused content", () => {
    const html = renderEditionEmailHtml(edition({ hero: pick({ title: "Baby & Me <fun>" }) }));
    expect(html).toContain("Baby &amp; Me &lt;fun&gt;");
    expect(html).not.toContain("Baby & Me <fun>");
  });
});

describe("renderEditionEmailHtml — Local's Secret quality guard", () => {
  it("omits the callout when local_note is short/absent", () => {
    const html = renderEditionEmailHtml(edition({ hero: pick({ localNote: "Nice spot." }) }));
    expect(html).not.toContain("Local&#39;s secret");
    expect(html).not.toContain("Local's secret");
  });

  it("shows the callout when local_note clears the length guard (~40+ chars)", () => {
    const longNote = "Park up on Cliff Drive and walk in from the west end, the lot fills fast.";
    expect(longNote.length).toBeGreaterThanOrEqual(40);
    const html = renderEditionEmailHtml(edition({ hero: pick({ localNote: longNote }) }));
    expect(html).toContain("Local's secret");
    expect(html).toContain(longNote);
  });
});

describe("renderEditionEmailHtml — missing image state matrix", () => {
  it("falls back to a brand color band instead of an <img> when imageUrl is null", () => {
    const html = renderEditionEmailHtml(edition({ hero: pick({ imageUrl: null }) }));
    expect(html).not.toMatch(/<img[^>]*Sunset jazz/);
    expect(html).toContain("#C0532E"); // terracotta fallback band
  });

  it("renders an <img> with correct alt text when an image and attribution exist", () => {
    const html = renderEditionEmailHtml(
      edition({ hero: pick({ imageUrl: "https://x.test/a.jpg", imageAttribution: "Jane Doe" }) }),
    );
    expect(html).toContain('alt="Sunset jazz on the Mesa (photo: Jane Doe)"');
  });

  it("falls back to a solid gradient tile (not an <img>) for a missing secondary thumbnail", () => {
    const html = renderEditionEmailHtml(
      edition({ secondaries: [pick({ thingId: "s1", title: "Market day", imageUrl: null, dayLabel: "Saturday" })] }),
    );
    expect(html).not.toMatch(/<img[^>]*Market day/);
    expect(html).toContain("#16586A"); // pacific fallback tile
  });
});

describe("renderEditionEmailHtml — secondaries + non-event + anchor bands", () => {
  it("renders all populated slots and omits absent ones", () => {
    const html = renderEditionEmailHtml(
      edition({
        secondaries: [pick({ thingId: "s1", title: "Market day", dayLabel: "Saturday" })],
        nonEvent: pick({ thingId: "n1", title: "New taqueria" }),
        anchor: null,
      }),
    );
    expect(html).toContain("Market day");
    expect(html).toContain("Also this weekend");
    expect(html).toContain("New taqueria");
    expect(html).toContain("New this week");
    expect(html).not.toContain("Always worth it");
  });
});

describe("renderEditionEmailHtml — long titles/blurbs wrap, never truncate (state matrix §10)", () => {
  it("passes a long hero title and blurb through in full, with no ellipsis/clipping styles applied to the text", () => {
    const longTitle = "The Santa Barbara International Orchid Show and Farmers Market Block Party Weekend";
    const longBlurb =
      "Three full blocks close to traffic for the day, with orchid growers from as far as Ventura " +
      "setting up alongside the regular Saturday stalls, so budget extra time to wander before the tasting tent lines start.";
    const html = renderEditionEmailHtml(edition({ hero: pick({ title: longTitle, blurb: longBlurb }) }));
    expect(html).toContain(longTitle);
    expect(html).toContain(longBlurb);
    expect(html).not.toMatch(/text-overflow|white-space:\s*nowrap/);
  });
});

describe("renderEditionEmailHtml — dark mode + structure", () => {
  it("includes a prefers-color-scheme: dark block and preheader hidden text", () => {
    const html = renderEditionEmailHtml(edition());
    expect(html).toContain("prefers-color-scheme: dark");
    expect(html).toContain("Our shortlist for the next three days.");
  });

  it("omits the unsubscribe link when unsubscribeUrl is null (permalink/preview context)", () => {
    const html = renderEditionEmailHtml(edition({ unsubscribeUrl: null }));
    expect(html).not.toContain("Unsubscribe</a>");
  });
});

describe("renderEditionPlainText", () => {
  it("is em-dash-free and includes every populated section", () => {
    const text = renderEditionPlainText(
      edition({
        secondaries: [pick({ thingId: "s1", title: "Market day — mornings only" })],
        nonEvent: pick({ thingId: "n1", title: "New taqueria" }),
        anchor: pick({ thingId: "a1", title: "The Courthouse tower" }),
      }),
    );
    expect(text).not.toContain("—");
    expect(text).toContain("Market day, mornings only");
    expect(text).toContain("New taqueria");
    expect(text).toContain("The Courthouse tower");
    expect(text).toContain("Unsubscribe: https://www.sbdaymaker.com/unsubscribe?token=abc");
  });
});
