// Gate 4 · G4.2, the hard-constraint filter. Before ranking, drop any candidate
// that CANNOT be true for this plan. This is the validation that makes the day
// "concierge" rather than "filter."
//
// Guiding rule (matches "the hero is never blank", CLAUDE.md §2.5): exclude only
// on a KNOWN violation. Missing data is never a violation. Gate-1 hours/setting
// are sparsely populated today, so an unknown-hours venue stays eligible; the
// filter tightens automatically as Gate-1 data is backfilled. Pure, no I/O, no AI.

import type { Thing } from "@/lib/things";
import type { Block, ResolvedParams } from "./types";
import { BLOCK_TO_TOD } from "./types";
import { blockHourRange, recurringStartHours, hourInBlockRange } from "./rankCandidates";
import { openStateAt, type SbNow } from "@/lib/format/openNow";
import { sameWalkCluster, adjacentZones } from "./zoneGraph";
import type { Zone } from "@/lib/zones";

// Budget rank: the lower the number, the cheaper. `free` sits below `$`.
const BAND_RANK: Record<string, number> = { free: 0, $: 1, $$: 2, $$$: 3 };
const BUDGET_CAP: Record<NonNullable<ResolvedParams["budget"]>, number> = {
  cheap: 1, // free + $
  mid: 2,   // up to $$
  treat: 3, // anything
};

/** The price rank for a thing, or null when unknown (free flag counts as 0). */
function priceRank(t: Thing): number | null {
  if (t.free) return 0;
  if (t.price_band && t.price_band in BAND_RANK) return BAND_RANK[t.price_band];
  return null;
}

/** Representative minute-of-day for a block, used to test open-hours when a venue
 *  has stored hours but no event start time. Uses the middle of the block window. */
function blockProbeMinute(block: Block): number {
  const [lo, hi] = blockHourRange(block);
  const mid = Math.floor((lo + hi) / 2);
  return mid * 60;
}

/** Weekday (0=Sun..6=Sat) for a YYYY-MM-DD date, SB-local calendar. */
function dowOf(dateISO: string): number {
  const [y, m, d] = dateISO.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export interface HardFilterContext {
  /** The user's answers, fully resolved/defaulted. */
  params: ResolvedParams;
  /** The block being filled (open-hours + block reachability depend on it). */
  block: Block;
  /** The cluster the day is anchored to (zone + its walkable group). Reachability
   *  is judged against this. Null = "Anywhere" (no reachability constraint). */
  anchorZone: Zone | null;
  /** Optional injected "now" for tests; defaults to real SB time for the probe. */
  now?: SbNow;
}

/** A candidate passes every hard rule for this plan+block. Returns the reason it
 *  was dropped (or null if eligible) so callers/tests can assert per-rule. */
export function violationReason(t: Thing, ctx: HardFilterContext): string | null {
  const { params, block, anchorZone } = ctx;

  // --- Quality: Tier-3 never enters a plan (getPublishedThings already strips it,
  //     but the engine must not rely on that being the only chokepoint). ---
  if (t.quality_tier === 3) return "quality_tier_3";

  // --- Open-hours validity (only when we KNOW the hours). ---
  //     Dated event: its start must land in the block window and on the date.
  if (t.starts_at) {
    const [lo, hi] = blockHourRange(block);
    const h = Number(
      new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Los_Angeles",
        hour: "numeric",
        hour12: false,
      }).format(new Date(t.starts_at)),
    );
    // Event on a different calendar day than the plan is out (dated events are
    // date-specific); rankCandidates already enforces same-day, we re-guard block.
    if (!(h >= lo && h < hi)) return "event_outside_block";
  } else {
    // Recurring event with a known start time: its schedule places it in a block
    // (a 9pm karaoke night is night-only), independent of a mis-enriched
    // time_of_day_fit. No recurring time -> no signal -> not a violation.
    const recHours = recurringStartHours(t);
    if (recHours.length > 0 && !recHours.some((rh) => hourInBlockRange(rh, block))) {
      return "recurring_outside_block";
    }
    if (t.hours && t.hours.length > 0) {
      // Evergreen venue with stored hours: must be open during the block window on
      // the plan's weekday. Unknown hours (the common case today) are NOT a violation.
      const now: SbNow = { dow: dowOf(ctx.params.dateISO), minute: blockProbeMinute(block) };
      const open = openStateAt(t.hours, now);
      if (open.state === "closed") return "closed_in_block";
    }
  }

  // --- Party rules. ---
  if (params.who === "family") {
    if (t.is_21_plus) return "family_21_plus";
    // Toddlers: no late-night stops (the "late" tod), regardless of block label.
    if (params.kidBand === "toddler") {
      const tods = BLOCK_TO_TOD[block];
      const isLateOnly = tods.length === 1 && tods[0] === "late";
      if (isLateOnly && (t.time_of_day_fit ?? []).every((v) => v === "late")) {
        return "toddler_late_night";
      }
      // A stop tagged only nightlife is never toddler-appropriate.
      if ((t.tags as string[]).includes("nightlife") && !(t.tags as string[]).includes("family_day")) {
        return "toddler_nightlife";
      }
    }
  }

  // --- Transport reachability (only when BOTH the anchor and the candidate have a
  //     known zone; unknown zone is not a violation). ---
  if (anchorZone && t.nearby_zone) {
    const z = t.nearby_zone as Zone;
    if (params.transport === "walk") {
      // On foot: stay inside the anchor's walkable cluster.
      if (!sameWalkCluster(anchorZone, z)) return "walk_out_of_cluster";
    } else if (params.transport === "bike") {
      // Bike: walkable cluster or one adjacent zone.
      if (!sameWalkCluster(anchorZone, z) && !adjacentZones(anchorZone).includes(z)) {
        return "bike_out_of_range";
      }
    }
    // Car: everything is reachable.
  }

  // --- Budget (only when we KNOW the price and a budget was chosen). The "mix"/
  //     one-splurge allowance is handled at assembly time, not here: the hard cap
  //     is one band above the chosen band, so a single $$$ can survive a $$ plan
  //     and the assembler limits how many splurges actually land. ---
  if (params.budget) {
    const rank = priceRank(t);
    const cap = BUDGET_CAP[params.budget];
    if (rank != null && rank > cap + 1) return "over_budget";
  }

  return null;
}

/** Keep only the candidates that violate no hard rule for this plan+block. */
export function hardFilter(pool: Thing[], ctx: HardFilterContext): Thing[] {
  return pool.filter((t) => violationReason(t, ctx) === null);
}

/** Is a thing within (at or below) the chosen budget band exactly (no splurge
 *  allowance)? Used by the assembler to cap how many splurges land. Unknown price
 *  counts as within-budget (never punish missing data). */
export function withinBudgetBand(t: Thing, budget: ResolvedParams["budget"]): boolean {
  if (!budget) return true;
  const rank = priceRank(t);
  if (rank == null) return true;
  return rank <= BUDGET_CAP[budget];
}

export { priceRank };
