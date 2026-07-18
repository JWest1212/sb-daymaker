// lib/quality/localSecret.ts  (Elevation v1 · Gate 1 · G1.8, Local's Secret quality bar)
//
// The Local's Secret block renders ONLY when there's a genuine secret. Founder
// decision: hide the section entirely rather than ship filler. The authoritative
// signal is the founder's own editing (a fake secret gets deleted in the
// cockpit), but this is the render-time defense: a "secret" that just restates
// the entry's own marketing copy (MOXI's rooftop-deck line was its blurb) is not
// a secret, so we suppress it deterministically. Conservative on purpose, high
// overlap only, so a genuinely distinct secret (Iglesias parking, the Lark) is
// never hidden by accident.

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s).split(" ").filter((w) => w.length > 3);
}

/** Is `note` a real secret, given the entry's own marketing copy? False when the
 *  note is empty or substantially reproducible from the blurb/reason. */
export function isRealSecret(
  note: string | null | undefined,
  marketing: { blurb?: string | null; blurb_long?: string | null; reason_to_go?: string | null },
): boolean {
  const n = (note ?? "").trim();
  if (n.length < 12) return false; // too short to carry a real insider fact

  const marketingText = [marketing.blurb, marketing.blurb_long, marketing.reason_to_go]
    .filter(Boolean)
    .join(" ");
  if (!marketingText.trim()) return true; // nothing to overlap against → trust the note

  const normNote = normalize(n);
  const normMarketing = normalize(marketingText);
  // Near-verbatim reuse of the marketing copy.
  if (normMarketing.includes(normNote)) return false;

  // High token overlap = the "secret" is the marketing said another way.
  const noteTokens = tokens(n);
  if (noteTokens.length === 0) return false;
  const marketingSet = new Set(tokens(marketingText));
  const shared = noteTokens.filter((t) => marketingSet.has(t)).length;
  // Two-thirds of the note's meaningful words already in the marketing copy = the
  // "secret" is the blurb said another way (MOXI's rooftop deck). Conservative:
  // a genuinely distinct secret (Iglesias parking) shares near zero, so it stays.
  return shared / noteTokens.length < 0.66;
}
