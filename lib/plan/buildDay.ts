// The deterministic slotting engine (build doc §3.2–3.3, Appendices D/E).
//
// buildDay() assembles a timed single day from already-published `things` plus a
// hand-authored day-shape skeleton. It is a PURE function — no network, no AI, no
// I/O — which is what keeps the Plan surface inside the batch-AI-only constraint
// (CLAUDE.md §2.3). Blurbs, tags, photos and zones are all pre-computed upstream.

import type { Thing } from "@/lib/things";
import type { OccasionKey } from "@/lib/occasions";
import type { Zone } from "@/lib/zones";
import type {
  Block,
  DayShape,
  PlanAnswers,
  Period,
  Stop,
  Who,
} from "./types";
import { DEFAULT_DAY_SHAPE } from "./dayShapes";

/** Canonical block order — the spine renders top→bottom in this sequence. */
export const BLOCK_ORDER: Block[] = [
  "morning",
  "midday",
  "afternoon",
  "evening",
  "night",
];

/** Human time labels for each block (build doc §Phase 4). */
export const BLOCK_TIME_LABEL: Record<Block, string> = {
  morning: "Morning · 9–11 AM",
  midday: "Midday · 12–2 PM",
  afternoon: "Afternoon · 2–5 PM",
  evening: "Evening · 6–8 PM",
  night: "Night · 9 PM+",
};

const FOOD_CATEGORIES = new Set([
  "food_drink_spot",
  "food_drink_event",
  "weekly_special",
]);

// Which DB `tod` a block wants its stop to fit (midday = a lunch slot, so it
// pulls from afternoon-fit food; night = the 'late' tod). Used to keep a dinner
// spot out of the morning, a hike out of the evening, etc.
const BLOCK_FIT_TOD: Record<Block, string> = {
  morning: "morning",
  midday: "afternoon",
  afternoon: "afternoon",
  evening: "evening",
  night: "late",
};

function periodToBlock(p: Period): Block {
  return p === "late" ? "night" : p;
}

/**
 * The active blocks for a day: the user's chosen periods, plus the auto MIDDAY
 * lunch bridge when BOTH morning and afternoon are covered, plus any blocks a
 * pinned spot needs (so pinned spots always have a home). Returned in canonical
 * order. (build doc §3.3)
 */
export function activeBlocks(periods: Period[], pinnedBlocks: Block[] = []): Block[] {
  const set = new Set<Block>(periods.map(periodToBlock));
  for (const b of pinnedBlocks) set.add(b);
  if (set.has("morning") && set.has("afternoon")) set.add("midday");
  return BLOCK_ORDER.filter((b) => set.has(b));
}

function isFoodish(thing: Thing): boolean {
  return (
    thing.tags.includes("wine_food") ||
    FOOD_CATEGORIES.has(thing.happening_category ?? "")
  );
}

/**
 * The block a thing most naturally belongs to — used to seat pinned saved spots
 * and to label them in the build-from-saved picker. Deterministic. (§3.3)
 */
export function naturalBlock(thing: Thing): Block {
  const tod = thing.time_of_day_fit ?? [];
  const tags = thing.tags;
  if (thing.is_21_plus || tags.includes("nightlife") || tod.includes("late")) {
    return "night";
  }
  if (tod.includes("evening") || tags.includes("date_night")) return "evening";
  if (tod.includes("morning")) return "morning";
  if (isFoodish(thing) && tod.includes("afternoon")) return "midday";
  if (tod.includes("afternoon")) return "afternoon";
  return isFoodish(thing) ? "midday" : "afternoon";
}

/** The YYYY-MM-DD a dated event falls on, in Santa Barbara local time. */
function eventLocalDate(startsAt: string): string {
  // Deterministic: derived purely from the input timestamp + a fixed timezone.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(startsAt));
}

/** Dated events must fall on the chosen date; everything else is evergreen. */
export function isAvailableOnDate(thing: Thing, dateISO: string): boolean {
  if (thing.type === "event" && thing.starts_at) {
    return eventLocalDate(thing.starts_at) === dateISO;
  }
  return true;
}

function isEvergreen(thing: Thing): boolean {
  return !(thing.type === "event" && thing.starts_at);
}

function firstTagMatchIndex(tags: OccasionKey[], slotTags: OccasionKey[]): number {
  for (let i = 0; i < slotTags.length; i++) {
    if (tags.includes(slotTags[i])) return i;
  }
  return -1;
}

/** Default per-block slot when a shape doesn't declare one. */
function slotFor(shape: DayShape, block: Block) {
  const declared = shape.slots[block];
  if (declared) return declared;
  const fallbackTags: Record<Block, OccasionKey[]> = {
    morning: ["outdoors_active"],
    midday: ["wine_food"],
    afternoon: ["arts_culture", "outdoors_active"],
    evening: ["wine_food", "date_night"],
    night: ["nightlife", "catch_a_show"],
  };
  return { tags: fallbackTags[block], areaHint: shape.anchorZones[0] };
}

interface ScoreContext {
  answers: PlanAnswers;
  shape: DayShape;
  block: Block;
  slot: { tags: OccasionKey[]; areaHint?: Zone };
  placedZones: Set<Zone>;
}

function preferredZone(ctx: ScoreContext): Zone | undefined {
  return ctx.answers.zone ?? ctx.slot.areaHint ?? ctx.shape.anchorZones[0];
}

function zoneIsAnchor(thing: Thing, ctx: ScoreContext): boolean {
  if (!thing.nearby_zone) return false;
  if (ctx.answers.zone) return thing.nearby_zone === ctx.answers.zone;
  if (ctx.slot.areaHint) return thing.nearby_zone === ctx.slot.areaHint;
  return ctx.shape.anchorZones.includes(thing.nearby_zone);
}

function whoBonus(thing: Thing, who: Who): number {
  if (who === "family" && thing.tags.includes("family_day")) return 10_000;
  if (who === "solo" && thing.tags.includes("solo")) return 4_000;
  if (who === "couple" && thing.tags.includes("date_night")) return 4_000;
  return 0;
}

/**
 * Relevance score for one candidate in one block. Higher is better. Ordering of
 * the bands encodes the build-doc ranking: slot-tag relevance dominates, then
 * vibe match, then dated-on-date, then anchor zone, then geographic coherence,
 * then the soft `who` signal — with a small evergreen tilt for fallbacks so a
 * stray off-theme event never beats a sensible evergreen. (§3.2)
 */
function scoreCandidate(thing: Thing, ctx: ScoreContext): number {
  const { answers } = ctx;
  let score = 0;

  const tagIdx = firstTagMatchIndex(thing.tags, ctx.slot.tags);
  const hasSlot = tagIdx >= 0;
  const hasVibe =
    answers.vibes.length > 0 &&
    thing.tags.some((t) => (answers.vibes as OccasionKey[]).includes(t));

  if (hasSlot) score += 1_000_000 - tagIdx * 10_000;
  if (hasVibe) score += 300_000;

  // Time-of-day fit: a stop should sit in the block its hours match. Reward a
  // match; discourage seating an off-time thing (a dinner at midday, say) when
  // its fits are known and don't include this block. Unknown fits stay neutral.
  const fits = thing.time_of_day_fit ?? [];
  if (fits.length > 0) {
    score += fits.includes(BLOCK_FIT_TOD[ctx.block]) ? 40_000 : -60_000;
  }

  // Dated-on-date outranks evergreen, but only among relevant candidates so a
  // fallback prefers a sensible evergreen over an off-theme event.
  if ((hasSlot || hasVibe) && !isEvergreen(thing)) score += 150_000;

  if (zoneIsAnchor(thing, ctx)) score += 50_000;
  if (thing.nearby_zone && ctx.placedZones.has(thing.nearby_zone)) score += 20_000;
  score += whoBonus(thing, answers.who);

  // Small tilts: "more happening" tiers, and evergreen in the fallback band.
  score += (4 - thing.happening_tier) * 100;
  if (!hasSlot && !hasVibe && isEvergreen(thing)) score += 200;

  return score;
}

/** Pick the best unused, available candidate for a block (or null). */
function pickForBlock(
  pool: Thing[],
  used: Set<string>,
  ctx: ScoreContext,
): Thing | null {
  let best: Thing | null = null;
  let bestScore = -Infinity;
  for (const thing of pool) {
    if (used.has(thing.id)) continue;
    if (!isAvailableOnDate(thing, ctx.answers.dateISO)) continue;
    // Family negative rule: never seat a 21+ spot in a family day.
    if (ctx.answers.who === "family" && thing.is_21_plus) continue;

    const score = scoreCandidate(thing, ctx);
    // Deterministic tie-break by id so the same inputs always yield the same day.
    if (score > bestScore || (score === bestScore && best && thing.id < best.id)) {
      best = thing;
      bestScore = score;
    }
  }
  return best;
}

/**
 * Assemble a single day. For each active block: seat a matching pinned saved
 * spot if one belongs there; otherwise pick the best-ranked unused `thing`.
 * Always fills a block when any candidate exists; drops a block only when it
 * genuinely cannot be filled (mirrors "the hero is never blank", §2.5).
 */
export function buildDay(
  answers: PlanAnswers,
  shape: DayShape,
  pool: Thing[],
  pinned: Thing[] = [],
): Stop[] {
  const byId = new Map(pool.map((t) => [t.id, t]));
  // Only pin things that actually exist in the pool and are available that day.
  const validPinned = pinned.filter(
    (p) => byId.has(p.id) && isAvailableOnDate(p, answers.dateISO),
  );

  const pinnedBlocks = validPinned.map(naturalBlock);
  const blocks = activeBlocks(answers.periods, pinnedBlocks);

  // Seat pinned spots into their natural block; on a collision, bump forward to
  // the next still-open active block (else that pin is dropped). (§3.2 edge)
  const pinnedByBlock = new Map<Block, Thing>();
  for (const p of validPinned) {
    let target: Block | undefined = naturalBlock(p);
    if (pinnedByBlock.has(target)) {
      target = blocks.find((b) => !pinnedByBlock.has(b));
    }
    if (target) pinnedByBlock.set(target, p);
  }

  const used = new Set<string>();
  const placedZones = new Set<Zone>();
  const stops: Stop[] = [];

  for (const block of blocks) {
    const pin = pinnedByBlock.get(block);
    if (pin) {
      used.add(pin.id);
      if (pin.nearby_zone) placedZones.add(pin.nearby_zone);
      stops.push({ block, thingId: pin.id, pinned: true, fromSaved: true });
      continue;
    }

    const ctx: ScoreContext = {
      answers,
      shape,
      block,
      slot: slotFor(shape, block),
      placedZones,
    };
    const pick = pickForBlock(pool, used, ctx);
    if (!pick) continue; // genuinely unfillable → drop the block (never blank)

    used.add(pick.id);
    if (pick.nearby_zone) placedZones.add(pick.nearby_zone);
    stops.push({ block, thingId: pick.id, pinned: false, fromSaved: false });
  }

  return stops;
}

/**
 * Ranked alternate candidates for one block — used by the swap sheet.
 * Returns up to `limit` things scored for `block`, excluding ids that are
 * already placed in OTHER blocks (the current block's occupant stays in the
 * list so the sheet can show it checked). Saved-first ordering is applied by
 * the UI; this returns by score so the sheet can partition freely.
 */
export function rankedCandidates(
  block: Block,
  answers: PlanAnswers,
  shape: DayShape,
  pool: Thing[],
  currentStops: Stop[],
  limit = 14,
): Thing[] {
  const byId = new Map(pool.map((t) => [t.id, t]));
  const excludeIds = new Set<string>();
  const placedZones = new Set<Zone>();

  for (const s of currentStops) {
    if (s.block !== block) {
      excludeIds.add(s.thingId);
      const t = byId.get(s.thingId);
      if (t?.nearby_zone) placedZones.add(t.nearby_zone);
    }
  }

  const slot = slotFor(shape, block);
  const ctx: ScoreContext = { block, answers, shape, slot, placedZones };

  return pool
    .filter((t) => !excludeIds.has(t.id) && isAvailableOnDate(t, answers.dateISO))
    .filter((t) => !(answers.who === "family" && t.is_21_plus))
    .map((t) => ({ thing: t, score: scoreCandidate(t, ctx) }))
    .sort(
      (a, b) =>
        b.score - a.score || (a.thing.id < b.thing.id ? -1 : 1),
    )
    .slice(0, limit)
    .map(({ thing }) => thing);
}

/**
 * The express "Make My Day" answers: today, the whole day, no vibe filter, no
 * anchor. buildDay(makeMyDayAnswers(today), DEFAULT_DAY_SHAPE, pool) is one tap.
 */
export function makeMyDayAnswers(dateISO: string): PlanAnswers {
  return {
    dateISO,
    periods: ["morning", "afternoon", "evening"],
    who: "couple",
    vibes: [],
    zone: null,
  };
}

export { DEFAULT_DAY_SHAPE };
