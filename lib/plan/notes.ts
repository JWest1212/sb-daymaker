// lib/plan/notes.ts
//
// R1 Wave 3 (W3.2). One place that decides what a draft says about itself.
//
// Two modules independently reported a missing meal: meals.ts said "We couldn't
// find an open lunch spot in your area and budget", validate.ts said "No lunch
// stop yet". They were de-duplicated by exact string match, which of course
// never matched, so the two could both appear, or (as the audit found) both be
// suppressed together by a single misclassification and leave the visitor with a
// one-stop day and no explanation at all (TP-A9-04).
//
// Now both produce notes carrying a `key`, and this reducer decides. A given
// subject gets exactly one sentence, and the more informative one wins.

import type { Block, Meal, PlanNote } from "./types";
import { BLOCK_LABEL } from "./labels";

/** Notes in the order a reader most needs them. Anything unlisted sorts last. */
const KIND_ORDER: PlanNote["kind"][] = [
  "thin_day",
  "meal_unfilled",
  "empty_block",
  "widened",
  "budget",
  "cluster",
];

/** Stable key for a note's subject, so two modules describing the same problem
 *  collapse to one sentence even when their wording differs. */
export function noteKey(n: PlanNote): string {
  return n.key ?? `${n.kind}:${n.text}`;
}

export interface NotesContext {
  stopCount: number;
  /** Meals the visitor asked for that have an active block. */
  meals: Meal[];
  /** Blocks that came back with nothing at all. */
  emptyBlocks: Block[];
  /** True when the pool offered no alternative draft to regenerate into. */
  noAlternatives?: boolean;
}

/** W3.2. A day with fewer than two stops is not a day, and saying so is better
 *  than handing over a single stop as though it were a plan. */
export const MIN_VIABLE_STOPS = 2;

/**
 * Collapse, order and complete the notes for a draft.
 *
 * `raw` is everything the engine reported, in the order it was reported: meals
 * first, then blocks, then validation. First one wins per key, which is what
 * makes meals.ts's more specific wording beat validate.ts's generic version.
 */
export function reduceNotes(raw: PlanNote[], ctx: NotesContext): PlanNote[] {
  const out: PlanNote[] = [];
  const seen = new Set<string>();

  const add = (n: PlanNote) => {
    const k = noteKey(n);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(n);
  };

  // A thin day is stated first, because it is the thing the visitor can see for
  // themselves and most wants explained.
  if (ctx.stopCount > 0 && ctx.stopCount < MIN_VIABLE_STOPS) {
    add({
      kind: "thin_day",
      key: "thin_day",
      text:
        "We could only fill one stop from what is on today. Add one you like, or widen the plan.",
    });
  }

  for (const n of raw) add(n);

  if (ctx.noAlternatives) {
    add({
      kind: "empty_block",
      key: "no_alternatives",
      text: "That is everything we have for this shape of day. Widen the plan for more options.",
    });
  }

  return out.sort((a, b) => rank(a) - rank(b));
}

function rank(n: PlanNote): number {
  const i = KIND_ORDER.indexOf(n.kind);
  return i === -1 ? KIND_ORDER.length : i;
}

/** W3.2. The note a block gets when nothing could fill it. Rendered in the slot
 *  itself so the shape of the day still reads, rather than the slot vanishing. */
export function emptyBlockText(block: Block): string {
  return `Nothing found for ${BLOCK_LABEL[block].toLowerCase()} yet. Add a stop or widen the plan.`;
}

/** W3.2 / W3.3. Stable keys, so the same subject is never said twice. */
export const noteKeys = {
  meal: (meal: Meal) => `meal:${meal}`,
  block: (block: Block) => `block:${block}`,
  widened: "widened",
} as const;
