// lib/edition/window.ts
//
// Window + per-type chrome constants (edition_build_spec.md §3.2, anatomy v3 §1).
// Reuses sbDay (lib/explore.ts), the single source of truth for SB-local day
// keying, so the drafter's window never disagrees with the public feed.

import { sbDay } from "../explore";
import type { EditionType } from "./types";

export interface EditionConfig {
  windowLabel: string; // "the weekend ahead" | "the week ahead"
  secondariesLabel: string; // "Also this weekend" | "Also this week"
  nonEventLabel: string; // "New this week" | "Worth exploring"
  anchorMode: "conditional" | "standing";
  spanDays: number; // days in the window, starting the day AFTER edition_date
  weekdayLabel: string; // "Thursday" | "Sunday" ({edition_weekday} token)
}

export const EDITION_CONFIG: Record<EditionType, EditionConfig> = {
  weekend: {
    windowLabel: "the weekend ahead",
    secondariesLabel: "Also this weekend",
    nonEventLabel: "New this week",
    anchorMode: "conditional",
    spanDays: 3, // Fri, Sat, Sun
    weekdayLabel: "Thursday",
  },
  week_ahead: {
    windowLabel: "the week ahead",
    secondariesLabel: "Also this week",
    nonEventLabel: "Worth exploring",
    anchorMode: "standing",
    spanDays: 4, // Mon, Tue, Wed, Thu
    weekdayLabel: "Sunday",
  },
};

/** The window of SB calendar days (YYYY-MM-DD) an edition covers: the N days
 *  immediately AFTER edition_date (Thu edition -> Fri..Sun; Sun edition -> Mon..Thu). */
export function windowDaysFor(editionType: EditionType, editionDateKey: string): string[] {
  const [y, m, d] = editionDateKey.split("-").map(Number);
  const base = Date.UTC(y, m - 1, d, 12); // noon anchor, matches sbWindowDays/sbDatesFrom convention
  const { spanDays } = EDITION_CONFIG[editionType];
  const days: string[] = [];
  for (let i = 1; i <= spanDays; i++) days.push(sbDay(base + i * 86_400_000));
  return days;
}

/** SB weekday (0=Sun..6=Sat) for a "YYYY-MM-DD" key, DST-safe (noon-UTC anchor). */
export function weekdayOf(sbDateKey: string): number {
  const [y, m, d] = sbDateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

// The send cron fires at 14:00 UTC on an edition's own date (vercel.json:
// "0 14 * * 0,4", same fixed-UTC, DST-drift-accepted convention as every
// other cron in this project; see app/api/cron/send-edition/route.ts).
export const SEND_HOUR_UTC = 14;

/** Has an edition's normal send window already passed? Used so approving an
 *  edition that was on hold (or otherwise missed its window) past its
 *  scheduled time can send it immediately instead of silently waiting for a
 *  cron that only ever sends "today's" edition and will never revisit a past
 *  date. `now` is injectable for tests; defaults to the real clock. */
export function scheduledSendPassed(editionDateKey: string, now: number = Date.now()): boolean {
  const scheduledAt = Date.parse(`${editionDateKey}T${String(SEND_HOUR_UTC).padStart(2, "0")}:00:00Z`);
  return now >= scheduledAt;
}
