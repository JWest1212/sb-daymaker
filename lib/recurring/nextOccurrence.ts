// lib/recurring/nextOccurrence.ts  (Elevation v1 · Gate 3 · G3.4)
//
// Compute a recurring schedule's next real date from cadence + day_of_week +
// nth_dow, so a card can say "Next: Fri Jul 24, 5pm" instead of a vague (and,
// per the Gate 0 Art Walk bug, dangerous) "every week". Pure and deterministic:
// same function backs the nightly write of recurring_schedules.next_occurrence AND
// the read-time render (so a card is never stale between nightly runs). No em dash.

import { sbDay } from "../explore";
import { clockLabel } from "../format/openNow";

export interface RecurInput {
  day_of_week: number | null; // 0 = Sun … 6 = Sat
  cadence?: string | null; // recurrence_cadence enum (preferred)
  frequency?: string | null; // legacy weekly|biweekly|monthly (fallback)
  nth_dow?: number | null; // for monthly_nth_dow / bimonthly (1 = first <weekday>)
  start_time?: string | null; // "HH:MM[:SS]"
  last_confirmed?: string | null; // "YYYY-MM-DD", the bimonthly phase anchor
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function effectiveCadence(input: RecurInput): string {
  return (input.cadence ?? input.frequency ?? "weekly").toLowerCase();
}

function nthWeekdayOfMonth(dom: number): number {
  return Math.ceil(dom / 7);
}

function monthIndexOf(key: string): number {
  const [y, m] = key.split("-").map(Number);
  return y * 12 + (m - 1);
}

/** The next SB date ("YYYY-MM-DD") on/after `fromKey` this schedule fires, or null
 *  when it can't be computed honestly (irregular/seasonal, or no weekday). */
export function nextOccurrence(input: RecurInput, fromKey: string): string | null {
  if (input.day_of_week == null) return null;
  const cadence = effectiveCadence(input);
  if (cadence === "irregular" || cadence === "seasonal") return null;

  const nth = input.nth_dow ?? 1;
  const [fy, fm, fd] = fromKey.split("-").map(Number);

  // Day-by-day forward scan (bounded ~14 months) with a per-cadence predicate.
  for (let i = 0; i < 430; i++) {
    const dt = new Date(Date.UTC(fy, fm - 1, fd + i, 12));
    if (dt.getUTCDay() !== input.day_of_week) continue;
    const key = dt.toISOString().slice(0, 10);

    if (cadence === "weekly" || cadence === "biweekly") {
      // Biweekly has no phase anchor in the schema, so the soonest matching
      // weekday is the honest best estimate (documented approximation).
      return key;
    }
    if (cadence === "monthly" || cadence === "monthly_nth_dow") {
      if (nthWeekdayOfMonth(dt.getUTCDate()) === nth) return key;
      continue;
    }
    if (cadence === "bimonthly") {
      if (nthWeekdayOfMonth(dt.getUTCDate()) !== nth) continue;
      const anchor = monthIndexOf(input.last_confirmed ?? key);
      if ((monthIndexOf(key) - anchor) % 2 === 0) return key;
      continue;
    }
    // Unknown cadence value: treat as weekly rather than hide the card.
    return key;
  }
  return null;
}

export interface NextResult {
  /** "YYYY-MM-DD" of the next occurrence. */
  date: string;
  /** "HH:MM[:SS]" start time, or null (time TBD). */
  time: string | null;
}

/** The soonest next occurrence across a thing's recurring rows.
 *   - a { date, time } when at least one row computes;
 *   - "irregular" when rows exist but none can be dated honestly;
 *   - null when there are no recurring rows at all. */
export function nextOccurrenceForThing(
  rows: RecurInput[],
  now: number = Date.now(),
): NextResult | "irregular" | null {
  if (!rows.length) return null;
  const fromKey = sbDay(now);
  let best: NextResult | null = null;
  for (const r of rows) {
    const date = nextOccurrence(r, fromKey);
    if (date && (!best || date < best.date)) best = { date, time: r.start_time ?? null };
  }
  return best ?? "irregular";
}

/** "Fri Jul 24" (+ ", 5pm" when a start time is known) from a NextResult. */
export function formatNextDate(result: NextResult): string {
  const [y, m, d] = result.date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12));
  const label = `${WEEKDAYS[dt.getUTCDay()]} ${MONTHS[m - 1]} ${d}`;
  if (!result.time) return label;
  return `${label}, ${clockLabel(result.time.slice(0, 5))}`;
}
