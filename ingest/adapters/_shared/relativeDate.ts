// ingest/adapters/_shared/relativeDate.ts
//
// "Today / Tomorrow / this Saturday / next Friday" → absolute ISO in SB time.
// Used by list pages (Eventbrite, Downtown SB) that print relative instead of
// absolute dates. Always resolves against the ingest runDate in America/Los_Angeles.
// Returns null on any ambiguity — the gate will drop it. (§2.4)

import { sbISO } from '../../tz';

const DOW_NAMES: Record<string, number> = {
  sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
  thursday: 4, friday: 5, saturday: 6,
};

// Tiny tz-aware "today" in SB (wall clock date only, YYYY-MM-DD)
const LA_TZ = 'America/Los_Angeles';
const sbDate = new Intl.DateTimeFormat('en-CA', { timeZone: LA_TZ, year: 'numeric', month: '2-digit', day: '2-digit' });

function runDayParts(runDateISO: string): { y: number; m: number; d: number } {
  const parts: Record<string, string> = {};
  for (const p of sbDate.formatToParts(new Date(runDateISO))) {
    if (p.type !== 'literal') parts[p.type] = p.value;
  }
  return { y: Number(parts.year), m: Number(parts.month), d: Number(parts.day) };
}

function addDays(utcBase: number, n: number): Date {
  return new Date(utcBase + n * 86_400_000);
}

/**
 * Parse a relative date phrase from a listing page, plus an optional HH:mm time,
 * into an SB-local ISO string. Returns null if unresolvable.
 *
 * Examples of text: "Today", "Tomorrow", "This Saturday", "Next Friday",
 *   "Saturday", "Fri"
 * timeHHmm: "20:00" — required for the gate to pass.
 */
export function parseRelativeDate(text: string, timeHHmm: string, runDateISO: string): string | null {
  if (!timeHHmm) return null;
  const [hh, mm] = timeHHmm.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const { y, m, d } = runDayParts(runDateISO);
  const runMidnight = Date.UTC(y, m - 1, d); // midnight UTC of run day (SB wall-clock)
  const normalized = text.trim().toLowerCase().replace(/\s+/g, ' ');

  if (normalized === 'today') {
    return sbISO(y, m, d, hh, mm);
  }

  if (normalized === 'tomorrow') {
    const t = addDays(runMidnight, 1);
    return sbISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), hh, mm);
  }

  // "this saturday" / "next friday" / plain weekday name / 3-letter abbrev
  const dayMatch = normalized.match(/^(?:(this|next)\s+)?(\w+)$/);
  if (!dayMatch) return null;
  const modifier = dayMatch[1]; // 'this' | 'next' | undefined
  const dayWord = dayMatch[2];
  const full = Object.keys(DOW_NAMES).find((k) => k.startsWith(dayWord));
  if (!full) return null;
  const targetDow = DOW_NAMES[full];

  const runDow = new Date(runMidnight).getUTCDay();
  let daysAhead = (targetDow - runDow + 7) % 7;
  if (daysAhead === 0 && modifier !== 'this') daysAhead = 7; // "next saturday" when today IS saturday
  if (modifier === 'next') daysAhead = (targetDow - runDow + 7) % 7 || 7; // at least 1 week

  const t = addDays(runMidnight, daysAhead);
  return sbISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate(), hh, mm);
}
