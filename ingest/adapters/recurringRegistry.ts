// ingest/adapters/recurringRegistry.ts
//
// The curated Tier-2 recurring-rhythm registry (Doc 10 §8 #7, Doc 11 §11 Phase 14):
// the steady weekly/biweekly/monthly happenings the scrapers can't reliably produce —
// farmers' markets, happy hours, trivia, art walks, live-music nights. The founder
// maintains the RHYTHMS list below; every entry lands as needs_review for confirmation.
//
// Honesty rule: when the DAY is known but the TIME isn't, the entry sets start:null —
// it lands with a BLANK start time + a "(time TBD)" label, never a guessed time.
// Rhythms are type:'place' (a null-start 'event' would violate events_have_start);
// tier 2 carries the schedule, not a starts_at.

import type { SourceAdapter } from './types';
import type { RawCandidate, RecurringSpec, RecurFrequency, HappeningCategory, Neighborhood } from '../../packages/shared/types';
import { getDb } from '../db';

interface Day { dow: number; start: string | null; end: string | null }
interface Rhythm {
  slug: string;
  title: string;
  venue: string;
  address: string;
  neighborhood: Neighborhood;
  category: HappeningCategory; // a Tier-2 value
  reasonToGo: string;
  frequency: RecurFrequency;
  sourceUrl: string;
  days: Day[];
}

// Curated, founder-maintained. Overlaps with the seed are skipped automatically.
const RHYTHMS: Rhythm[] = [
  {
    slug: 'sb-saturday-farmers-market',
    title: 'Santa Barbara Saturday Farmers Market',
    venue: 'Santa Barbara & Cota Streets', address: 'Santa Barbara St & Cota St, Santa Barbara, CA 93101',
    neighborhood: 'downtown', category: 'recurring_market', frequency: 'weekly',
    reasonToGo: 'Saturday-morning stalls of strawberries, flowers, and warm tamales, rain or shine.',
    sourceUrl: 'https://sbfarmersmarket.org/markets/saturday-santa-barbara/',
    days: [{ dow: 6, start: '08:30', end: '13:00' }],
  },
  {
    slug: 'sb-tuesday-state-st-market',
    title: 'Santa Barbara Tuesday State Street Market',
    venue: 'State St (500–600 block)', address: '500 State St, Santa Barbara, CA 93101',
    neighborhood: 'downtown', category: 'recurring_market', frequency: 'weekly',
    reasonToGo: 'A weekday afternoon market down the middle of State Street.',
    sourceUrl: 'https://sbfarmersmarket.org/markets/tuesday-old-town/',
    days: [{ dow: 2, start: '15:00', end: '18:30' }],
  },
  {
    slug: 'old-town-goleta-market',
    title: 'Old Town Goleta Farmers Market',
    venue: 'Goleta Community Center area', address: '5679 Hollister Ave, Goleta, CA 93117',
    neighborhood: 'goleta', category: 'recurring_market', frequency: 'weekly',
    reasonToGo: 'Goleta’s neighborhood market — local produce and easy parking.',
    sourceUrl: 'https://sbfarmersmarket.org/',
    days: [{ dow: 0, start: '10:00', end: '14:00' }],
  },
  {
    // Day known, time NOT published -> blank start + flag (demonstrates the rule).
    slug: 'lama-dog-live-music',
    title: 'Live Music at Lama Dog',
    venue: 'Lama Dog Tap Room + Bottle Shop', address: '116 Santa Barbara St, Santa Barbara, CA 93101',
    neighborhood: 'funk_zone', category: 'recurring_nightlife', frequency: 'weekly',
    reasonToGo: 'Funk Zone taproom with weekend live sets — check the board for the start time.',
    sourceUrl: 'https://www.lamadog.com/',
    days: [{ dow: 5, start: null, end: null }],
  },
];

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Build the recurring_schedules specs for one rhythm (label + time_unknown flag). */
export function toRecurringSpecs(r: Rhythm): RecurringSpec[] {
  return r.days.map((d) => {
    const timeUnknown = d.start == null;
    const dayWord = DOW[d.dow];
    const freqHint = r.frequency === 'monthly' ? `1st ${dayWord}/month` : r.frequency === 'biweekly' ? `Biweekly ${dayWord}` : dayWord;
    return {
      day_of_week: d.dow,
      start_time: d.start,
      end_time: d.end,
      frequency: r.frequency,
      label: `${freqHint}${timeUnknown ? ' (time TBD)' : ''}`,
      time_unknown: timeUnknown,
    };
  });
}

export const recurringRegistry: SourceAdapter = {
  key: 'registry',
  label: 'Recurring registry',
  async fetch(): Promise<RawCandidate[]> {
    // Skip rhythms already present (e.g. seeded) so we never duplicate.
    const sb = getDb();
    const { data } = await sb.from('things').select('title');
    const existing = new Set((data ?? []).map((t) => String(t.title).trim().toLowerCase()));

    return RHYTHMS.filter((r) => !existing.has(r.title.trim().toLowerCase())).map((r): RawCandidate => ({
      source: 'registry',
      title: r.title,
      venueName: r.venue,
      address: r.address,
      tier: 2,
      category: r.category,
      type: 'place',               // null-start tier-2; 'event' would break events_have_start
      startStrategy: 'none',       // schedule-backed, no instant
      priceLow: null,
      explicitlyFree: r.category === 'recurring_market',
      neighborhood: r.neighborhood,
      reasonToGo: r.reasonToGo,
      sourceUrl: r.sourceUrl,
      recurring: toRecurringSpecs(r),
      raw: { slug: r.slug },
    }));
  },
};
