// ingest/weight.ts
//
// W2.1b, the civic-filler classifier. A tiny, deterministic (no AI) rule that
// auto-downweights government/administrative items so a "Street Tree Advisory
// Committee" meeting stops ranking as a top card. It returns an editorial_weight
// nudge only; cascade() then sinks negatives to the bottom of their tier section
// (still visible + findable, never hidden). A founder ▲ in the cockpit overrides
// it in two seconds, which is the intended escape hatch for any false positive.
//
// TRUST NOTE: this writes founder-style curation (editorial_weight), never any
// sponsor/placement field. The ranker still never reads is_featured/sponsor_id.

/** Case-insensitive, word-boundary civic-meeting patterns. `subcommittee` is listed
 *  separately because `\bcommittee\b` won't match inside "subcommittee" (no boundary
 *  before "committee"). `advisory board` is distinct from the bare `committee` catch;
 *  "advisory committee" is already covered by `committee`. `city council` is scoped to
 *  the government body, a bare `council` would wrongly catch legit orgs (e.g. an Arts
 *  Council). */
const CIVIC_RE =
  /\b(committee|subcommittee|commission|advisory board|board meeting|public hearing|agenda review|city council|task force|study session)\b/i;

/** Founder-curation nudge for a candidate at land time. Returns −3 for civic/admin
 *  filler (by title), else 0. `sourceKey` is accepted for future per-source tuning but
 *  is intentionally unused today, the title alone is a strong enough signal.
 *
 *  Known, accepted false positive: a promotional title like "Concert Series Committee
 *  Presents…" will match and be downweighted. That's the deliberate trade (§W2.1b), *  a founder ▲ fixes it instantly, and the alternative (prose disambiguation) isn't
 *  worth the complexity or the determinism cost. */
export function classifyWeight(c: { title: string; sourceKey?: string }): number {
  return CIVIC_RE.test(c.title ?? "") ? -3 : 0;
}
