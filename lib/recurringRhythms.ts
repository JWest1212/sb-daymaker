// lib/recurringRhythms.ts
//
// Client-safe types + pure helpers for the Recurring Rhythms cockpit surface
// (Data Arch Redesign, recurring-registry spec, Phase 3). Mirrors the
// neighborhoodSweep.ts / neighborhoodSweepServer.ts split: this file has no
// server-only imports; lib/recurringRhythmsServer.ts holds the DB access.

export interface RecurringRhythmDay {
  dow: number; // 0 = Sunday
  start: string | null; // 'HH:MM' or null (time unknown)
  end: string | null;
}

export interface RecurringRhythmRow {
  id: string;
  slug: string;
  title: string;
  venue: string;
  address: string;
  neighborhood: string;
  category: string;
  reason_to_go: string;
  frequency: string;
  source_url: string;
  days: RecurringRhythmDay[];
  occasion_tags: string[] | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface RecurringRhythmInput {
  title: string;
  venue: string;
  address: string;
  neighborhood: string;
  category: string;
  reasonToGo: string;
  frequency: string;
  sourceUrl: string;
  day: RecurringRhythmDay;
  occasionTags?: string[] | null;
}

// The 5 Tier-2 values (schema's happening_category enum), the only categories
// a recurring rhythm can carry.
export const RECURRING_CATEGORIES = [
  'weekly_special', 'recurring_nightlife', 'recurring_market', 'recurring_arts', 'recurring_outdoors',
] as const;

export const RECUR_FREQUENCIES = ['weekly', 'biweekly', 'monthly'] as const;

export const DOW_LABELS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** "recurring_market" -> "Recurring Market". Snake-case enum value -> display label. */
export function titleCaseLabel(snake: string): string {
  return snake.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/** Display string for a rhythm's single day/time, e.g. "Saturdays, 8:30am–1pm" or
 *  "Fridays (time TBD)". Mirrors the label wording toRecurringSpecs() computes for land. */
export function formatDayTime(freq: string, day: RecurringRhythmDay): string {
  const dayWord = DOW_LABELS[day.dow] ?? '?';
  const freqPrefix = freq === 'monthly' ? '1st ' : freq === 'biweekly' ? 'Biweekly ' : '';
  const dayLabel = `${freqPrefix}${freq === 'monthly' ? dayWord : `${dayWord}s`}`;
  if (day.start == null) return `${dayLabel} (time TBD)`;
  const range = day.end ? `${fmtTime(day.start)}–${fmtTime(day.end)}` : fmtTime(day.start);
  return `${dayLabel}, ${range}`;
}

function fmtTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'am' : 'pm';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${h12}${period}` : `${h12}:${String(m).padStart(2, '0')}${period}`;
}
