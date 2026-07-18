// ingest/adapters/recurringRegistry.ts
//
// The curated Tier-2 recurring-rhythm registry (Doc 10 §8 #7, Doc 11 §11 Phase 14):
// the steady weekly/biweekly/monthly happenings the scrapers can't reliably produce, // farmers' markets, happy hours, trivia, art walks, live-music nights. The founder
// maintains these rhythms in the `recurring_rhythms` DB table (edited via the
// /admin/coverage/recurring-rhythms cockpit, Data Arch Redesign, recurring-registry
// spec) instead of hand-editing this file. Every entry lands as needs_review.
//
// Honesty rule: when the DAY is known but the TIME isn't, the entry sets start:null, // it lands with a BLANK start time + a "(time TBD)" label, never a guessed time.
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

interface RhythmRow {
  slug: string;
  title: string;
  venue: string;
  address: string;
  neighborhood: Neighborhood;
  category: HappeningCategory;
  reason_to_go: string;
  frequency: RecurFrequency;
  source_url: string;
  days: Day[];
  occasion_tags: OccasionTag[] | null;
}

function rowToRhythm(row: RhythmRow): Rhythm {
  return {
    slug: row.slug,
    title: row.title,
    venue: row.venue,
    address: row.address,
    neighborhood: row.neighborhood,
    category: row.category,
    reasonToGo: row.reason_to_go,
    frequency: row.frequency,
    sourceUrl: row.source_url,
    days: row.days,
    occasionTags: row.occasion_tags ?? undefined,
  };
}

// Loaded once per run from `recurring_rhythms` (active rows only) and cached here so
// the synchronous isAlreadyInRegistry() dedupe check (run.ts, per-candidate, §3.3)
// doesn't need its own DB round-trip. run.ts calls loadRegistryCache() once before
// the adapter loop starts, ahead of any adapter that sets registryCandidate:true.
let cachedRhythms: Rhythm[] | null = null;

export async function loadRegistryCache(): Promise<Rhythm[]> {
  const sb = getDb();
  const { data, error } = await sb.from('recurring_rhythms').select('*').eq('active', true);
  if (error) throw new Error(`recurring_rhythms fetch: ${error.message}`);
  cachedRhythms = (data ?? []).map(rowToRhythm);
  return cachedRhythms;
}

function rhythms(): Rhythm[] {
  if (cachedRhythms == null) {
    throw new Error('recurringRegistry: loadRegistryCache() must run before isAlreadyInRegistry()/fetch()');
  }
  return cachedRhythms;
}

const DOW = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/**
 * Returns true if a registry-candidate RawCandidate matches an entry already
 * present in the curated registry (the `recurring_rhythms` table, loaded into
 * the module cache by loadRegistryCache()). Used by run.ts to drop re-proposals
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
  return rhythms().some((r) => {
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

    return rhythms().filter((r) => !existing.has(r.title.trim().toLowerCase())).map((r): RawCandidate => ({
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
