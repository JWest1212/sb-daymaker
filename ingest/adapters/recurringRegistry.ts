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
import { seedOccasionTags } from './_shared/occasionTags';
import type { RawCandidate, RecurringSpec, RecurFrequency, HappeningCategory, Neighborhood, OccasionTag } from '../../packages/shared/types';
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
  occasionTags?: OccasionTag[]; // override the seedOccasionTags() default when set
}

// Curated, founder-maintained. Exported so the run.ts dedupe check can compare
// incoming registry candidates against the live file without a DB round-trip (§3.3).
export const RHYTHMS: Rhythm[] = [
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
    slug: 'sunday-goleta-farmers-market',
    title: "Sunday Farmers' Market — Goleta",
    venue: '7986 Calle Real', address: '7986 Calle Real, Goleta, CA 93117',
    neighborhood: 'goleta', category: 'recurring_market', frequency: 'weekly',
    reasonToGo: 'Goleta’s neighborhood market — local produce and easy parking.',
    sourceUrl: 'https://www.sbfarmersmarket.org/markets',
    days: [{ dow: 0, start: '10:00', end: '14:00' }],
    occasionTags: ['hosting_visitors', 'free_sb', 'family_day', 'wine_food', 'outdoors_active', 'solo'],
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

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Returns true if a registry-candidate RawCandidate matches an entry already
 * present in the curated RHYTHMS array. Used by run.ts to drop re-proposals
 * with reason 'registry_exists' (§3.3). Key: slug(venue)+dows+slug(title).
 */
export function isAlreadyInRegistry(c: {
  title?: string;
  venueName?: string;
  recurring?: { day_of_week: number }[];
}): boolean {
  const cTitle = slug(c.title ?? '');
  const cVenue = slug(c.venueName ?? '');
  const cDows = (c.recurring ?? []).map((r) => r.day_of_week).sort().join(',');
  return RHYTHMS.some((r) => {
    const rDows = r.days.map((d) => d.dow).sort().join(',');
    return slug(r.title) === cTitle || (slug(r.venue) === cVenue && rDows === cDows);
  });
}

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
      occasionTags: r.occasionTags ?? seedOccasionTags({ category: r.category }),
      recurring: toRecurringSpecs(r),
      raw: { slug: r.slug },
    }));
  },
};
