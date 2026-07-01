// ingest/adapters/carpinteriaArts.ts
//
// Carpinteria Arts Center — Google Calendar iCal feed (§8.4).
// carpinteriaartscenter.org uses Givecloud CMS with an embedded Google Calendar
// (not WordPress/Tribe). iCal export URL extracted from the Google Calendar embed
// on /calendar. RRULE recurring events (e.g., monthly Art Faire) are handled by
// parseIcsFeed and may surface as registry candidates.
//
// Tier 1 (dated shows) + Tier 2 (recurring rhythms via RRULE).
// category: arts_theater / recurring_arts.
// seed: arts_culture, family_day, free_sb.
//
// useManagedScrape: false. Public Google Calendar iCal — no auth required.

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { parseIcsFeed } from './_shared/ics';

const SOURCE_KEY = 'carpinteriaArts';
const VENUE_NAME = 'Carpinteria Arts Center';
const VENUE_ADDRESS = '855 Linden Ave, Carpinteria, CA 93013';

// Public iCal export for the Google Calendar embedded on carpinteriaartscenter.org/calendar.
// Calendar ID decoded from the embed src= base64 param (verified 2026-06-30).
const GCAL_ICAL =
  'https://calendar.google.com/calendar/ical/r7tetof6mb29q9mcupeo9iq5fo%40group.calendar.google.com/public/basic.ics';

// Drop internal/administrative events
const DENY: RegExp[] = [
  /\bmeeting\b/i,
  /\bboard\b/i,
  /\bstaff\b/i,
  /\bworkshop\b.*\bstaff\b/i,
  /\btraining\b/i,
  /\bprivate\b/i,
  /\bclosed\b/i,
];

function isDenied(title: string): boolean {
  return DENY.some((rx) => rx.test(title));
}

export const carpinteriaArts: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Carpinteria Arts Center',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    try {
      const cands = await parseIcsFeed(GCAL_ICAL, w, {
        sourceKey: SOURCE_KEY,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: 'carpinteria',
        category: 'arts_theater',
        tier: 1,
      });
      return cands.filter((c) => !isDenied(c.title ?? ''));
    } catch (err) {
      console.warn(`[carpinteriaArts] iCal unavailable: ${err}`);
      return [];
    }
  },
};
