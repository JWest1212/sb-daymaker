// ingest/publishGate.ts
//
// Data Arch Redesign 24 Phase 2/3, the conservative auto-publish gate (Doc 16
// §2.5/§3.8). Pure, no I/O: takes a data_confidence score + the resolved
// source's authority/lane and returns which of three bands it falls in.
// Phase 2 used this in shadow mode only (label, don't act). Phase 3
// (ingest/run.ts applyPublishGate()) is the only place this band drives a
// real status write.
//
// TRUST RULE: nothing here reads sponsor_id / is_featured / hero_eligible.
// The gate is a quality/publish signal only, never a sponsorship signal.

/** One config constant, the whole dial. Widen the auto-publish band later
 *  (e.g. lower minSourceAuthority for a source once its sources.reliability
 *  has earned it) by editing these numbers, nothing else.
 *
 *  minConfidence 0.85 (not 0.90), Jim's 2026-07-16 decision after reviewing
 *  the shadow-mode projection: 96 things from already-fully-trusted sources
 *  (SOhO, the Bowl, Lobero, Music Academy, etc.) were sitting just under 0.90
 *  on completeness/freshness alone, not on trust. Relaxing the polish bar for
 *  sources that already clear minSourceAuthority nearly doubled auto-publish
 *  (93 -> 182 projected) without admitting any new source tier. The authority
 *  floor stays at 0.90 deliberately, lowering IT (not confidence) barely
 *  moved the count and would open the door to bulk civic/aggregator sources
 *  (e.g. the 310-listing City of Santa Barbara calendar) that haven't earned
 *  it yet. */
export const AUTO_PUBLISH_GATE = {
  minConfidence: 0.85,
  minSourceAuthority: 0.90,
  requireStructuredLane: true, // 'structured' only; excludes spec-25 AI-extracted (lane='generic'/'render') by construction
} as const;

/** Below this, a thing is held (not shown), not suppressed, a later run or a
 *  second source can still rescue it (spec 24 §5). */
export const HOLD_FLOOR = 0.35;

/** Jim's 2026-11-26 decision: everything the cockpit's "Bulk-approve green"
 *  button would publish now publishes on its own, with no click. A green chip
 *  is a dated or recurring thing (tier 1 or 2) with a deterministic start
 *  time, the same rule lib/review.ts chipFor() draws the chip from. The strict
 *  gate (ingest/gate.ts) already refuses any dated event without one, and AI
 *  never sets a start, so this rule only ever admits a sourced clock time.
 *
 *  excludedSourcePrefixes: public /submit entries keep a human look. Anyone
 *  can type into that form, so a submitted event with a real date and time
 *  would otherwise go live unseen. Remove the prefix to auto-publish them too.
 *  Set enabled to false to return to click-to-approve for green chips. */
export const GREEN_CHIP_AUTO_PUBLISH = {
  enabled: true,
  excludedSourcePrefixes: ['submission:'] as readonly string[],
} as const;

/** The cockpit's green chip: not evergreen, and a start time is stored. */
export function isGreenChip(tier: number, startsAt: string | null | undefined): boolean {
  return tier !== 3 && !!startsAt;
}

export type PublishBand = 'auto_publish' | 'review' | 'hold';

export interface GateInput {
  confidence: number;                   // things.data_confidence
  sourceAuthority: number | undefined;  // sources.authority for the resolved source
  lane: string | undefined;             // sources.lane ('structured' | 'generic' | 'render')
  /** things.happening_tier, things.starts_at and the raw things.source, for
   *  the green-chip rule. Omit them and only the confidence rule applies. */
  tier?: number;
  startsAt?: string | null;
  source?: string | null;
}

/** True when the green-chip rule alone would auto-publish this thing. */
export function meetsGreenChipRule(input: GateInput): boolean {
  if (!GREEN_CHIP_AUTO_PUBLISH.enabled) return false;
  if (input.tier == null || !isGreenChip(input.tier, input.startsAt)) return false;
  const source = input.source ?? '';
  return !GREEN_CHIP_AUTO_PUBLISH.excludedSourcePrefixes.some((p) => source.startsWith(p));
}

export function classifyBand(input: GateInput): PublishBand {
  if (meetsGreenChipRule(input)) return 'auto_publish';
  const meetsAutoPublish =
    input.confidence >= AUTO_PUBLISH_GATE.minConfidence &&
    (input.sourceAuthority ?? 0) >= AUTO_PUBLISH_GATE.minSourceAuthority &&
    (!AUTO_PUBLISH_GATE.requireStructuredLane || input.lane === 'structured');
  if (meetsAutoPublish) return 'auto_publish';
  if (input.confidence < HOLD_FLOOR) return 'hold';
  return 'review';
}
