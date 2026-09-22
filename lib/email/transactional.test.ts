import { describe, it, expect } from "vitest";
import { renderTransactionalEmail, MAILING_ADDRESS } from "./transactional";
import { CADENCE_LINE } from "@/lib/edition/cadence";

// R1 W7.7 (EML-001). The confirmation email wears the digest's template.
describe("renderTransactionalEmail", () => {
  const out = renderTransactionalEmail({
    preheader: "One tap and you're in.",
    heading: "Confirm your digest",
    paragraphs: ["Tap the button to confirm."],
    button: { label: "Confirm my subscription", url: "https://www.sbdaymaker.com/confirm?token=abc" },
    footNote: "Didn't sign up? Ignore this email, or {unsubscribe}.",
    unsubscribeUrl: "https://www.sbdaymaker.com/unsubscribe?token=xyz",
    cadence: true,
  });

  it("carries the wordmark, Plaster ground, a display heading, one Pacific button and the address", () => {
    expect(out.html).toContain("SB Daymaker");
    expect(out.html).toContain("#F6F1E7");
    expect(out.html).toContain("Georgia");
    expect((out.html.match(/background-color:#16586A/g) ?? []).length).toBe(1);
    expect(out.html).toContain(MAILING_ADDRESS.replace("·", "&middot;").split(" &middot; ")[0]);
    expect(out.html).toContain("78 Brandon Drive");
  });

  it("prints the single cadence string, word for word", () => {
    expect(out.html).toContain(CADENCE_LINE);
    expect(out.text).toContain(CADENCE_LINE);
  });

  it("keeps a plain-text alternative with the link and the unsubscribe URL", () => {
    expect(out.text).toContain("Confirm my subscription: https://www.sbdaymaker.com/confirm?token=abc");
    expect(out.text).toContain("unsubscribe (https://www.sbdaymaker.com/unsubscribe?token=xyz)");
  });

  it("escapes what it is given and never emits an em dash", () => {
    const r = renderTransactionalEmail({
      preheader: "x", heading: "A <b>bold</b> claim", paragraphs: ["Tom & Jerry"],
      button: { label: "Go", url: "https://x.y/?a=1&b=2" },
    });
    expect(r.html).toContain("A &lt;b&gt;bold&lt;/b&gt; claim");
    expect(r.html).toContain("Tom &amp; Jerry");
    expect(r.html).not.toContain(String.fromCharCode(0x2014));
  });
});
