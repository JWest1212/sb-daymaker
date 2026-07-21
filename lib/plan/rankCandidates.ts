// Pure, deterministic ranking. No AI. Used by both the picker (AddStopSheet)
// and buildDraft to seed the spine.

import { BLOCK_TO_TOD } from "./types";
import type { Block, PlanAnswers, Tod } from "./types";
import type { Thing } from "@/lib/things";

// ---- Time helpers -----------------------------------------------------------

function formatSBHour(iso: string): number {
  const h = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  }).format(new Date(iso));
  return parseInt(h, 10);
}

function sbDay(iso: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  }).format(new Date(iso));
}

// Returns [startHour, endHour) in 24h SB local time for a block.
//   morning:   12am – 12pm  (0–12)
//   afternoon: 12pm – 5pm   (12–17)
//   night:     5pm – 12am   (17–24)
export function blockHourRange(block: Block): [number, number] {
  switch (block) {
    case "morning":   return [0,  12];
    case "afternoon": return [12, 17];
    case "night":     return [17, 24];
  }
}

function inBlockWindow(iso: string, block: Block): boolean {
  const h = formatSBHour(iso);
  const [lo, hi] = blockHourRange(block);
  return h >= lo && h < hi;
}

/** True when a 24h hour lands inside a block's window. */
export function hourInBlockRange(hour: number, block: Block): boolean {
  const [lo, hi] = blockHourRange(block);
  return hour >= lo && hour < hi;
}

/** The start hours (0-23) declared by a thing's recurring schedules. A recurring
 *  event (starts_at is null) carries its real time here: a 9pm karaoke night has
 *  start_time "21:00:00", so it belongs to the night block, never afternoon,
 *  regardless of a mis-enriched time_of_day_fit. Empty when no schedule has a time. */
export function recurringStartHours(t: Thing): number[] {
  return (t.recurring ?? [])
    .map((r) => r.start_time)
    .filter((s): s is string => typeof s === "string" && s.length >= 2)
    .map((s) => parseInt(s.slice(0, 2), 10))
    .filter((h) => Number.isFinite(h) && h >= 0 && h <= 23);
}

function sameDay(iso: string, dateISO: string): boolean {
  return sbDay(iso) === dateISO;
}

// ---- Who boost --------------------------------------------------------------

function whoBoost(who: PlanAnswers["who"], t: Thing): boolean {
  if (who === "solo"   && t.tags.includes("solo"))       return true;
  if (who === "family" && t.tags.includes("family_day") && !t.is_21_plus) return true;
  if (who === "couple" && t.tags.includes("date_night")) return true;
  if (who === "friends" && t.tags.includes("nightlife")) return true;
  return false;
}

// ---- Public API -------------------------------------------------------------

export interface RankedThing {
  thing: Thing;
  score: number;
  savedState: "want" | "been" | null;
}

/**
 * Rank `pool` for a given block + answers. Filters, then scores.
 *
 * savedStateFor: a function that returns the save-state for a thingId
 *   ("want" | "been" | null). Pass `() => null` when saves aren't relevant.
 *
 * exclude: set of thingIds to omit (used by buildDraft to avoid duplicates).
 */
export function rankCandidates(
  block: Block,
  answers: PlanAnswers,
  pool: Thing[],
  savedStateFor: (id: string) => "want" | "been" | null,
  exclude: Set<string> = new Set(),
): RankedThing[] {
  const todValues = BLOCK_TO_TOD[block];

  return pool
    .filter((t) => {
      if (exclude.has(t.id)) return false;
      // Nightlife tags are never appropriate for a morning slot.
      if (block === "morning" && (t.tags as string[]).includes("nightlife")) return false;
      // Dated items: must be on the chosen date AND within the block window.
      if (t.starts_at) {
        return sameDay(t.starts_at, answers.dateISO) && inBlockWindow(t.starts_at, block);
      }
      // Recurring events with a known start time must fall in this block's window
      // (a 9pm karaoke night is a night stop, never an afternoon one). A recurring
      // thing with no start_time carries no time signal, so it stays eligible.
      const recHours = recurringStartHours(t);
      if (recHours.length > 0) {
        return recHours.some((h) => hourInBlockRange(h, block));
      }
      return true;
    })
    .map((t) => {
      let s = 0;
      // Time-of-day fit: intersect UI block with DB tod values.
      if (t.time_of_day_fit?.some((v) => todValues.includes(v as Tod))) s += 3;
      // Vibe match.
      if (answers.vibes.some((v) => (t.tags as string[]).includes(v))) s += 3;
      // Who boost.
      if (whoBoost(answers.who, t)) s += 1;
      // Zone proximity.
      if (answers.zone && t.nearby_zone === answers.zone) s += 2;
      // Dated-on-date items already guaranteed by filter; reward with score.
      if (t.starts_at) s += 2;
      const savedState = savedStateFor(t.id);
      // Saved items get a top-band boost.
      if (savedState) s += 4;
      return { thing: t, score: s, savedState };
    })
    .sort(
      (a, b) =>
        (b.savedState ? 1 : 0) - (a.savedState ? 1 : 0) || b.score - a.score,
    );
}
