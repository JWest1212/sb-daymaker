// lib/quality/tierScore.ts  (Elevation v1 · Gate 1 · G1.1, the Entry Quality Gate)
//
// THE load-bearing rule of the whole build: an entry earns its tier from what it
// actually carries, so thin filler can never masquerade as curated. Pure and
// deterministic (no AI, no I/O, no clock) so it runs identically in the nightly
// pipeline (recompute after enrich), in the one-off backfill, and in tests.
//
// quality_tier is EDITORIAL completeness. It is deliberately distinct from
// happening_tier (dated/recurring/evergreen STRUCTURE). The two never conflate.
//
//   1 = full/verified, passes all six gate checks; renders the full card.
//   2 = demoted/compact, has what-it-is + a location, but is thin on a real
//                         secret/logistics fact or a real image; renders compact,
//                         still discoverable.
//   3 = hidden, missing a what-it-is sentence OR a location; quarantined
//                         from the public feed until fixed (sits in the cockpit).
//
// This replaces culling (founder decision: "demote, never cull").

import { hasDaypartConflict } from "../format/daypart";

export type QualityTier = 1 | 2 | 3;

/** The minimal shape tierScore reads. A `Thing`, a `Candidate`, or a raw DB row
 *  can all be narrowed to this, so one scorer serves render, pipeline, and tests. */
export interface TierInput {
  type?: string | null;
  title?: string | null;
  blurb?: string | null;
  blurb_long?: string | null;
  reason_to_go?: string | null;
  address?: string | null;
  lat?: number | null;
  lng?: number | null;
  nearby_zone?: string | null;
  neighborhood?: string | null;
  local_note?: string | null;
  practical_note?: string | null;
  starts_at?: string | null;
  photo_url?: string | null;
  photo_source?: string | null;
  visual_kind?: string | null;
  price_band?: string | null;
  free?: boolean | null;
  buy_url?: string | null;
}

/** The six gate checks, exposed so the backfill/cockpit can explain a score
 *  ("why is this Tier 2?") and tests can assert each boundary independently. */
export interface TierBreakdown {
  whatItIs: boolean;   // a human learns what the thing actually is
  location: boolean;   // an address, real coordinates, or a zone to point at
  insiderFact: boolean;// a real Local's Secret or concrete logistics fact
  daypartOk: boolean;  // copy doesn't contradict the true time of day (Gate 0)
  realImage: boolean;  // a real photo, or an intentional motif (no fake photo)
  price: boolean;      // Free, a real band, or ticketed with an outbound
}

function nonTrivial(s: string | null | undefined): boolean {
  // A what-it-is sentence, not a bare name. "LOTG" / "Coast Village Pop-Up" are
  // just labels; they carry no space-separated descriptive clause of real length.
  if (!s) return false;
  const t = s.trim();
  return t.length >= 20 && t.includes(" ");
}

function isEvent(input: TierInput): boolean {
  return input.type === "event" || input.type === "happyhour" || !!input.starts_at;
}

/** The six checks, pure. */
export function tierBreakdown(input: TierInput): TierBreakdown {
  const whatItIs =
    nonTrivial(input.blurb) || nonTrivial(input.blurb_long) || nonTrivial(input.reason_to_go);

  // A location we can send someone to: a street address, real coordinates, or at
  // minimum a coarse zone (the founder-sanctioned carve-out for area-only outdoor
  // spots). "other"/unknown zone does not count.
  const hasCoords = input.lat != null && input.lng != null;
  const hasZone = !!input.nearby_zone && input.nearby_zone !== "other";
  const location = !!(input.address && input.address.trim()) || hasCoords || hasZone;

  // Something a Google Maps card couldn't tell you: a real secret or a concrete
  // logistics note. (An event's logistics live in practical_note too.)
  const insiderFact = nonTrivial(input.local_note) || nonTrivial(input.practical_note);

  // Gate 0 validator: for a dated thing, the copy must not contradict its daypart.
  const daypartOk = !(
    input.starts_at &&
    (hasDaypartConflict(input.blurb, input.starts_at) ||
      hasDaypartConflict(input.blurb_long, input.starts_at))
  );

  // A real image, or an intentional motif/big-type (which makes no pretense of
  // being a photo). A bare "placeholder" source is not a real image.
  const realImage =
    (!!input.photo_url && input.photo_source !== "placeholder") ||
    input.visual_kind === "motif" ||
    input.visual_kind === "bigtype";

  // A resolved price: Free, a real band, or a ticketed event handing off outbound.
  const price =
    input.free === true ||
    !!input.price_band ||
    (isEvent(input) && !!input.buy_url);

  return { whatItIs, location, insiderFact, daypartOk, realImage, price };
}

/** Score an entry's quality tier (1/2/3), deterministic. */
export function tierScore(input: TierInput): QualityTier {
  const b = tierBreakdown(input);
  // Missing the two non-negotiables → quarantine (hidden from the public feed).
  if (!b.whatItIs || !b.location) return 3;
  // Earns full only by passing all six.
  if (b.whatItIs && b.location && b.insiderFact && b.daypartOk && b.realImage && b.price) {
    return 1;
  }
  // Has the essentials but is thin somewhere → demoted, compact, still findable.
  return 2;
}
