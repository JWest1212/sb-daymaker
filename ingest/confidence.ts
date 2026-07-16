// ingest/confidence.ts
//
// Data Arch Redesign 24 — the data_confidence score (Doc 16 §3.8, §2.5).
// Pure, no I/O, unit-testable: takes a thing + its resolved source metadata
// and returns a 0-1 score plus the per-input breakdown (Phase 4 reuses the
// breakdown for the Queue's "why it's here" reasons). The gate/publish
// decision itself is NOT in this file — Phase 2/3 build that on top of the
// score this file computes.
//
// TRUST RULE: nothing here reads sponsor_id / is_featured. Source trust comes
// only from sources.authority + sources.reliability (a quality/publish
// signal), never sponsorship.

export interface SourceMeta {
  authority: number;   // sources.authority, 0-1
  reliability: number; // sources.reliability, 0-1
  lane: string;         // 'structured' | 'generic' | 'render' (spec 23)
}

export interface ThingForConfidence {
  happening_tier: number;        // 1 dated | 2 recurring | 3 evergreen
  starts_at: string | null;
  address: string | null;
  blurb: string | null;
  photo_url: string | null;
  photo_source: string | null;
  nearby_zone: string | null;
  activities: string[] | null;
  last_confirmed: string | null; // date-ish string
  source_count: number;          // things.source_count once Phase 1 DDL lands; default 1
  /** Set by the caller from a recurring_schedules join — true only when a
   *  Tier-2 row has both a day_of_week and a real (non-TBD) start_time. */
  scheduleConfirmed?: boolean;
}

/** The whole dial, in one place. Weights sum to 1.0 — tighten/loosen a single
 *  input's influence by editing its number here, nothing else. */
export const CONFIDENCE_WEIGHTS = {
  sourceTrust: 0.30,
  extractionMethod: 0.20,
  fieldCompleteness: 0.20,
  crossSourceAgreement: 0.10,
  recency: 0.10,
  findability: 0.10,
} as const;

export interface ConfidenceBreakdown {
  sourceTrust: number;
  extractionMethod: number;
  fieldCompleteness: number;
  crossSourceAgreement: number;
  recency: number;
  findability: number;
}

export interface ConfidenceResult {
  score: number; // 0-1, rounded to 2 decimals to match numeric(3,2)
  breakdown: ConfidenceBreakdown;
}

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

/** Venue-direct/high-authority sources score highest; an unmatched source key
 *  (shouldn't happen once `sources` is fully seeded) sorts last at 0, same
 *  fallback dedupe.ts already uses for sourceAuthority(). */
export function sourceTrustScore(source: SourceMeta | undefined): number {
  if (!source) return 0;
  return clamp01(source.authority * 0.6 + source.reliability * 0.4);
}

/** Structured (API/ICS/JSON-LD) scores highest. Spec 25 will start setting
 *  lane='generic' for AI-extracted rows — corroborated (source_count>=2)
 *  scores above a single-source AI extraction. Every live source is
 *  'structured' today, so in practice this is a flat 1.0 across the whole
 *  catalog until spec 25 ships. */
export function extractionMethodScore(source: SourceMeta | undefined, sourceCount: number): number {
  if (source?.lane === 'structured') return 1.0;
  return sourceCount >= 2 ? 0.6 : 0.4;
}

/** Fraction of the fields that actually apply to this thing's tier. Tier 3
 *  (evergreen) has no date/time to score. Tier 2's date/time slot is satisfied
 *  by a CONFIRMED schedule (day + real start time, not "time TBD"), not by
 *  merely having a recurring_schedules row. */
export function fieldCompletenessScore(t: ThingForConfidence): number {
  const hasDescription = !!(t.blurb && t.blurb.trim());
  const hasImage = !!(t.photo_url && t.photo_source && t.photo_source !== 'placeholder');
  const hasAddress = !!(t.address && t.address.trim());

  if (t.happening_tier === 3) {
    const applicable = [hasAddress, hasDescription, hasImage];
    return applicable.filter(Boolean).length / applicable.length;
  }

  const hasDateTime = t.happening_tier === 1 ? !!t.starts_at : !!(t.scheduleConfirmed || t.starts_at);
  const applicable = [hasDateTime, hasAddress, hasDescription, hasImage];
  return applicable.filter(Boolean).length / applicable.length;
}

/** source_count is always 1 until spec 26's dedupe sets it — a deliberately
 *  neutral 0.5 (not a penalty) for the unconfirmed-single-source case, so this
 *  input doesn't drag every score down before cross-source data exists. */
export function crossSourceAgreementScore(sourceCount: number): number {
  if (sourceCount >= 3) return 1.0;
  if (sourceCount === 2) return 0.8;
  return 0.5;
}

/** Freshly (re)confirmed rows score higher than stale ones. */
export function recencyScore(lastConfirmed: string | null, now: Date = new Date()): number {
  if (!lastConfirmed) return 0;
  const days = (now.getTime() - new Date(lastConfirmed).getTime()) / 86_400_000;
  if (days <= 1) return 1.0;
  if (days <= 7) return 0.8;
  if (days <= 30) return 0.5;
  if (days <= 90) return 0.25;
  return 0.1;
}

/** Doc 18 — a resolved zone and at least one activity tag. Missing these
 *  lowers confidence but never blocks (Place is a sort, not a gate). */
export function findabilityScore(t: ThingForConfidence): number {
  const hasZone = !!t.nearby_zone;
  const hasActivity = !!(t.activities && t.activities.length > 0);
  return (hasZone ? 0.5 : 0) + (hasActivity ? 0.5 : 0);
}

/** The composite. A weighted sum, not a precise probability — the point is a
 *  defensible ordering (spec 24 §2.1). */
export function computeDataConfidence(
  t: ThingForConfidence,
  source: SourceMeta | undefined,
  now: Date = new Date(),
): ConfidenceResult {
  const breakdown: ConfidenceBreakdown = {
    sourceTrust: sourceTrustScore(source),
    extractionMethod: extractionMethodScore(source, t.source_count),
    fieldCompleteness: fieldCompletenessScore(t),
    crossSourceAgreement: crossSourceAgreementScore(t.source_count),
    recency: recencyScore(t.last_confirmed, now),
    findability: findabilityScore(t),
  };
  const raw =
    breakdown.sourceTrust * CONFIDENCE_WEIGHTS.sourceTrust +
    breakdown.extractionMethod * CONFIDENCE_WEIGHTS.extractionMethod +
    breakdown.fieldCompleteness * CONFIDENCE_WEIGHTS.fieldCompleteness +
    breakdown.crossSourceAgreement * CONFIDENCE_WEIGHTS.crossSourceAgreement +
    breakdown.recency * CONFIDENCE_WEIGHTS.recency +
    breakdown.findability * CONFIDENCE_WEIGHTS.findability;
  return { score: Math.round(clamp01(raw) * 100) / 100, breakdown };
}
