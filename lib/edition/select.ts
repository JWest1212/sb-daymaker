// lib/edition/select.ts
//
// The deterministic, sponsor-blind slot selection (edition_build_spec.md §3.3,
// §3.6). Reuses pickEvergreenFallback (lib/explore.ts) and occursOnDate
// (lib/occurrences.ts) rather than forking that logic a second time (spec §3,
// heroServer.ts parallel), but ranking itself (editionCascade, below) is
// edition-specific, NOT the public site's cascade(). cascade() sorts Tier-1
// primarily by starts_at, which is right for the live "what's happening now"
// feed but wrong for a multi-day digest window: it lets the earliest day in
// the window sweep every bench slot before a stronger later-day pick is ever
// considered. An edition ranks holistically across every day it covers.
//
// Ranking (`rankedBench`, cascade order, rank 0 = best) and render order
// (`picks`) are deliberately different lists: the bench is "what the ranker
// would suggest" for the cockpit swap control; picks are reordered
// chronologically (secondaries) because that's how a reader expects a
// weekend/week rundown to read.
//
// Cooldown (§3.6) excludes a thing from the AUTO-PICK only, not from the
// bench, the bench still shows a recently-featured thing (grayed out by the
// cockpit later) so an operator can deliberately re-select it (is_manual=true
// overrides cooldown by design).

import { pickEvergreenFallback } from "../explore";
import { occursOnDate, type OccThing } from "../occurrences";
import type { Thing } from "../things";
import type {
  AnchorSelection,
  DraftThing,
  EditionSelection,
  EditionType,
  HeroSelection,
  SlotSelection,
} from "./types";
import { EDITION_CONFIG } from "./window";

const BENCH_SIZE = { hero: 12, secondary: 12, nonevent: 12, anchor: 12 } as const;

function occThing(t: DraftThing): OccThing {
  return { happening_tier: t.happening_tier, starts_at: t.starts_at, recurring: t.recurring };
}

/** Does this thing occur on ANY day within the window (Tier-1 dated in-window,
 *  or Tier-2 recurring landing on one of the window's weekdays)? Tier-3 is
 *  intentionally excluded here, evergreens aren't "qualifying" secondaries,
 *  they're the anchor's own tier. */
function qualifiesInWindow(t: DraftThing, windowDays: string[]): boolean {
  if (t.happening_tier !== 1 && t.happening_tier !== 2) return false;
  return windowDays.some((d) => occursOnDate(occThing(t), d));
}

/** The earliest window day a qualifying thing lands on, used only to render
 *  secondaries in chronological order (spec §3.3). */
function earliestWindowDay(t: DraftThing, windowDays: string[]): string {
  for (const d of windowDays) if (occursOnDate(occThing(t), d)) return d;
  return windowDays[windowDays.length - 1];
}

function asThings(things: DraftThing[]): Thing[] {
  // editionCascade only reads happening_tier / editorial_weight / starts_at, // safe to cast rather than build full Thing objects (mirrors heroServer.ts).
  return things as unknown as Thing[];
}

/** Edition ranking: editorial_weight (founder curation) is the primary signal
 *  for every tier, across the ENTIRE window at once, a Sunday standout can
 *  outrank a mediocre Friday pick. starts_at only breaks a tie between two
 *  equally-weighted Tier-1 items (soonest first, for legibility). Mirrors
 *  cascade()'s tier-ordering and negative-weight-sinks conventions so the two
 *  rankers stay recognizably related, but is NOT cascade(), see module header. */
function editionCascade(things: Thing[]): Thing[] {
  return things
    .map((t, i) => [t, i] as const)
    .sort(([a, ia], [b, ib]) => {
      if (a.happening_tier !== b.happening_tier) return a.happening_tier - b.happening_tier;

      // Negatives sink within their tier section (both negative → keep relative order).
      const aNeg = a.editorial_weight < 0;
      const bNeg = b.editorial_weight < 0;
      if (aNeg !== bNeg) return aNeg ? 1 : -1;

      if (a.editorial_weight !== b.editorial_weight) return b.editorial_weight - a.editorial_weight;
      if (a.happening_tier === 1 && a.starts_at && b.starts_at && a.starts_at !== b.starts_at)
        return a.starts_at.localeCompare(b.starts_at); // tie-break only

      return ia - ib; // stable input order
    })
    .map(([t]) => t);
}

function rankedOf(things: DraftThing[]): DraftThing[] {
  return editionCascade(asThings(things)) as unknown as DraftThing[];
}

function freshnessKey(t: DraftThing): string {
  return t.created_at ?? t.last_confirmed ?? "";
}

/** Non-event ranking: First Look items first, then freshest-first (created_at,
 *  falling back to last_confirmed), the "simple rule, not a rotation engine"
 *  the anatomy doc (§2, non-event segment) calls for. */
function rankNonEvent(things: DraftThing[]): DraftThing[] {
  return [...things].sort((a, b) => {
    const af = a.type === "firstlook" ? 0 : 1;
    const bf = b.type === "firstlook" ? 0 : 1;
    if (af !== bf) return af - bf;
    return freshnessKey(b).localeCompare(freshnessKey(a));
  });
}

function firstClearingCooldown(ranked: DraftThing[], cooldownIds: Set<string>): DraftThing | null {
  return ranked.find((t) => !cooldownIds.has(t.id)) ?? null;
}

export interface SelectEditionInput {
  things: DraftThing[]; // ALL published things (sponsor-blind columns only)
  heroPinThingId: string | null; // pre-validated: resolved from hero_pins across the window
  cooldownIds: Set<string>;
  editionType: EditionType;
  windowDays: string[];
  editionDateKey: string; // for the evergreen rotation (pickEvergreenFallback)
}

export function selectEdition(input: SelectEditionInput): EditionSelection {
  const { things, heroPinThingId, cooldownIds, editionType, windowDays, editionDateKey } = input;
  const chosenIds = new Set<string>();

  // ---------------------------------------------------------------- HERO ---
  const heroBenchPool = things.filter((t) => t.hero_eligible && qualifiesInWindow(t, windowDays));
  const heroRanked = rankedOf(heroBenchPool);
  const heroBench = heroRanked.slice(0, BENCH_SIZE.hero);

  let hero: HeroSelection;
  const pinned = heroPinThingId ? things.find((t) => t.id === heroPinThingId) : undefined;
  const pinValid =
    pinned && pinned.hero_eligible && qualifiesInWindow(pinned, windowDays) ? pinned : null;

  if (pinValid) {
    hero = { picks: [pinValid], rankedBench: heroBench, source: "pin" };
  } else {
    const autoPick = firstClearingCooldown(heroRanked, cooldownIds);
    if (autoPick) {
      hero = { picks: [autoPick], rankedBench: heroBench, source: "auto" };
    } else {
      // Evergreen fallback, cooldown-filtered first; if that empties the
      // pool, "never blank" wins over cooldown (spec §3.6 flags this case).
      if (heroRanked.length > 0) {
        // heroRanked had candidates but EVERY one is in cooldown, the pool itself
        // (not just this window) is too small for the 12-edition memory. Spec §3.6:
        // "surface a warning in the ops digest", console.warn is picked up by both
        // the GitHub Action log and draftEdition.ts's own summary output.
        console.warn(
          `[edition select] hero pool (${heroRanked.length} candidates) fully exhausted by ` +
            `12-edition cooldown, falling back to evergreen. Consider growing the evergreen pool.`,
        );
      }
      const tier3Clear = things.filter((t) => t.happening_tier === 3 && !cooldownIds.has(t.id));
      const evergreen =
        pickEvergreenFallback(asThings(tier3Clear), editionDateKey) ??
        pickEvergreenFallback(asThings(things), editionDateKey);
      hero = evergreen
        ? { picks: [evergreen as unknown as DraftThing], rankedBench: heroBench, source: "evergreen" }
        : { picks: [], rankedBench: heroBench, source: "none" };
    }
  }
  if (hero.picks[0]) chosenIds.add(hero.picks[0].id);

  // ----------------------------------------------------------- SECONDARY ---
  const secondaryPool = things.filter(
    (t) => !chosenIds.has(t.id) && qualifiesInWindow(t, windowDays),
  );
  const secondaryRanked = rankedOf(secondaryPool);
  const secondaryBench = secondaryRanked.slice(0, BENCH_SIZE.secondary);
  const secondaryAutoPicks: DraftThing[] = [];
  for (const t of secondaryRanked) {
    if (secondaryAutoPicks.length >= 3) break;
    if (!cooldownIds.has(t.id)) secondaryAutoPicks.push(t);
  }
  const secondaryPicks = [...secondaryAutoPicks].sort(
    (a, b) =>
      earliestWindowDay(a, windowDays).localeCompare(earliestWindowDay(b, windowDays)) ||
      secondaryRanked.indexOf(a) - secondaryRanked.indexOf(b),
  );
  for (const t of secondaryPicks) chosenIds.add(t.id);
  const secondary: SlotSelection = { picks: secondaryPicks, rankedBench: secondaryBench };

  // ----------------------------------------------------------- NON-EVENT ---
  // "Non-event" is the name, not just the position: a dated event belongs in
  // secondaries, not here. Excluding type='event' keeps this slot a genuine
  // First-Look/New-This-Week/discovery pick (place, firstlook, happy hour).
  const nonEventPool = things.filter((t) => !chosenIds.has(t.id) && t.type !== "event");
  const nonEventRanked = rankNonEvent(nonEventPool);
  const nonEventBench = nonEventRanked.slice(0, BENCH_SIZE.nonevent);
  const nonEventPick = firstClearingCooldown(nonEventRanked, cooldownIds);
  if (nonEventPick) chosenIds.add(nonEventPick.id);
  const nonevent: SlotSelection = { picks: nonEventPick ? [nonEventPick] : [], rankedBench: nonEventBench };

  // --------------------------------------------------------------- ANCHOR ---
  const anchorPool = things.filter(
    (t) => !chosenIds.has(t.id) && t.happening_tier === 3 && t.hero_eligible,
  );
  const anchorRanked = rankedOf(anchorPool);
  const anchorBench = anchorRanked.slice(0, BENCH_SIZE.anchor);
  const fires =
    EDITION_CONFIG[editionType].anchorMode === "standing" || secondaryPicks.length < 3;
  let anchorPick = fires ? firstClearingCooldown(anchorRanked, cooldownIds) : null;
  if (fires && !anchorPick && anchorRanked.length > 0) {
    // "never skip" wins over cooldown here too, same as the hero's evergreen path.
    console.warn(
      `[edition select] anchor pool (${anchorRanked.length} candidates) fully exhausted by ` +
        `12-edition cooldown, repeating the top-ranked anchor. Consider growing the evergreen pool.`,
    );
    anchorPick = anchorRanked[0];
  }
  if (anchorPick) chosenIds.add(anchorPick.id);
  const anchor: AnchorSelection = {
    picks: anchorPick ? [anchorPick] : [],
    rankedBench: anchorBench,
    fires: fires && !!anchorPick,
  };

  return { hero, secondary, nonevent, anchor };
}
