// lib/occurrences.ts
//
// EXACT Tier-1 + Tier-2 occurrence math for the Cockpit v2 Coverage heatmap.
//
// Why this exists (recon §7 / delta A3): the public Explore feed never expands
// recurring_schedules — Tier 2 items simply always pass the horizon filter. So
// there is no site function to "reuse" for counting recurring occurrences in a
// window. This module is the single, shared definition Coverage (and the Hero
// plan's candidate logic) build on. It reuses lib/explore's `sbDay` day-keying
// so Tier-1 date math matches the site exactly.

import { sbDay } from "./explore";

export type Frequency = "weekly" | "biweekly" | "monthly";

export interface RecurRow {
  day_of_week: number | null; // 0=Sun … 6=Sat
  frequency: string | null;   // 'weekly' | 'biweekly' | 'monthly'
}

export interface OccThing {
  happening_tier: number;
  starts_at: string | null;
  recurring: RecurRow[];
}

export const COVERAGE_WINDOWS = [7, 14, 30, 45] as const;
export type CoverageWindow = (typeof COVERAGE_WINDOWS)[number];

interface DayCell { dow: number; dom: number; }

/** The next `n` SB calendar days from `now`, as {weekday, day-of-month}. Offset 0 = today.
 *  Built at noon UTC so the SB calendar date == UTC date (SB is UTC-7/-8), letting
 *  getUTCDay/getUTCDate read the SB weekday + day-of-month with no DST drift. */
function sbWindowDays(now: number, n: number): DayCell[] {
  const [y, m, d] = sbDay(now).split("-").map(Number);
  const out: DayCell[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
    out.push({ dow: dt.getUTCDay(), dom: dt.getUTCDate() });
  }
  return out;
}

/** Tier-1: 1 if the dated start's SB day is within the next `windowDays`, else 0. */
function tier1Occurrences(startsAt: string, windowDays: number, now: number): number {
  const todayKey = sbDay(now);
  const startKey = sbDay(new Date(startsAt).getTime());
  if (startKey < todayKey) return 0; // already passed in SB time (matches withinHorizon)
  const [y, m, d] = todayKey.split("-").map(Number);
  const lastKey = sbDay(Date.UTC(y, m - 1, d + windowDays - 1, 12));
  return startKey <= lastKey ? 1 : 0;
}

/** Tier-2: exact count of one recurring row's occurrences among `days`. */
function tier2Occurrences(row: RecurRow, days: DayCell[]): number {
  if (row.day_of_week == null) return 0;
  const matches = days.filter((c) => c.dow === row.day_of_week);
  const freq = (row.frequency ?? "weekly") as Frequency;
  if (freq === "monthly") {
    // "1st {weekday} of the month" — day-of-month in 1..7 for that weekday.
    return matches.filter((c) => c.dom >= 1 && c.dom <= 7).length;
  }
  if (freq === "biweekly") {
    // The schema carries no phase anchor for biweekly, so count every other
    // matching week from the first in-window occurrence. Deterministic and
    // monotonic across cumulative windows. (Documented approximation.)
    return Math.ceil(matches.length / 2);
  }
  return matches.length; // weekly
}

/** Total Tier-1 + Tier-2 occurrences of a thing within `windowDays`. Tier-3 → 0. */
export function occurrencesInWindow(
  thing: OccThing,
  windowDays: number,
  now: number = Date.now(),
): number {
  if (thing.happening_tier === 1) {
    return thing.starts_at ? tier1Occurrences(thing.starts_at, windowDays, now) : 0;
  }
  if (thing.happening_tier === 2) {
    const days = sbWindowDays(now, windowDays);
    return (thing.recurring ?? []).reduce((sum, r) => sum + tier2Occurrences(r, days), 0);
  }
  return 0; // Tier 3 evergreen — excluded from the RAG math (§1.1)
}

/** Does a thing occur on a specific SB calendar date ("YYYY-MM-DD")? Used by the
 *  Hero plan to decide a day's valid candidates + pin validity. Tier 3 (evergreen)
 *  is valid any day; biweekly is treated as eligible on its weekday (no phase anchor). */
export function occursOnDate(thing: OccThing, sbDate: string): boolean {
  if (thing.happening_tier === 3) return true;
  if (thing.happening_tier === 1) {
    return thing.starts_at ? sbDay(new Date(thing.starts_at).getTime()) === sbDate : false;
  }
  if (thing.happening_tier === 2) {
    const [y, m, d] = sbDate.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d, 12));
    const dow = dt.getUTCDay(), dom = dt.getUTCDate();
    return (thing.recurring ?? []).some((r) => {
      if (r.day_of_week !== dow) return false;
      if ((r.frequency ?? "weekly") === "monthly") return dom >= 1 && dom <= 7; // 1st weekday of month
      return true; // weekly | biweekly
    });
  }
  return false;
}

/** Occurrences across all four cumulative windows at once (one pass for Coverage).
 *  The 45-day list is a superset of the smaller windows, so slicing gives the
 *  exact cumulative count for each. */
export function occurrencesByWindow(
  thing: OccThing,
  now: number = Date.now(),
): Record<CoverageWindow, number> {
  const maxDays = sbWindowDays(now, 45);
  const result = {} as Record<CoverageWindow, number>;
  for (const w of COVERAGE_WINDOWS) {
    if (thing.happening_tier === 1) {
      result[w] = thing.starts_at ? tier1Occurrences(thing.starts_at, w, now) : 0;
    } else if (thing.happening_tier === 2) {
      const slice = maxDays.slice(0, w);
      result[w] = (thing.recurring ?? []).reduce((s, r) => s + tier2Occurrences(r, slice), 0);
    } else {
      result[w] = 0;
    }
  }
  return result;
}
