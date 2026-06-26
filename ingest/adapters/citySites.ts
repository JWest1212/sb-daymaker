// ingest/adapters/citySites.ts
//
// City of Santa Barbara civic calendar (calendar.santabarbaraca.gov) — a
// Localist-style listing. Each event's "View Details" link carries a fully
// structured aria-label:  View Details - "<title>" on <Weekday>, <Month> <D>, <Y> @ <h:mm><am/pm>
// — so we parse title + an exact, year-bearing start time straight from it
// (startStrategy:'server_detail').

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { sbISO } from '../tz';

const ORIGIN = 'https://calendar.santabarbaraca.gov';
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Parse a "View Details - …" aria-label into { title, startISO }, or null. */
export function parseCityAria(aria: string): { title: string; startISO: string } | null {
  const m = aria.match(/^View Details - "(.+?)" on \w+,\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*@\s*(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (!m) return null;
  const month = MONTHS[m[2].slice(0, 3).toLowerCase()];
  if (!month) return null;
  let hour = Number(m[5]) % 12;
  if (m[7].toLowerCase() === 'pm') hour += 12;
  return { title: m[1].trim(), startISO: sbISO(Number(m[4]), month, Number(m[3]), hour, Number(m[6])) };
}

/** Coarse category from the civic-event title. */
export function classifyCity(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/\b(swim|run|hike|walk|sport|recreation|garden|cleanup|trail|yoga|fitness)/.test(t)) return 'sports_outdoors_event';
  // Arts before music so a "Band Shell" venue doesn't mis-tag a puppet show.
  if (/\b(art|theat|marionette|puppet|gallery|museum|film|dance)/.test(t)) return 'arts_theater';
  if (/\b(music|concert|jazz|symphony|recital)/.test(t)) return 'live_music';
  if (/\b(market|fair|festival|parade|celebration)/.test(t)) return 'festival_fair';
  if (/\b(wine|food|taste|brew|culinary)/.test(t)) return 'food_drink_event';
  return 'community_gathering';
}

/** Venue from a "Title | Venue" pattern, else generic SB. */
function venueFromTitle(title: string): string {
  const parts = title.split('|');
  return parts.length > 1 ? parts[parts.length - 1].trim() : 'Santa Barbara';
}

async function get(url: string): Promise<string> {
  const headers = { 'user-agent': 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)' };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`City SB ${res.status}`);
      return await res.text();
    } catch (err) { if (attempt === 1) throw err; }
  }
  throw new Error('unreachable');
}

export const citySites: SourceAdapter = {
  key: 'citysb',
  label: 'City of Santa Barbara',
  async fetch(): Promise<RawCandidate[]> {
    const $ = cheerio.load(await get(`${ORIGIN}/events/upcoming`));
    const bySlug = new Map<string, RawCandidate>();
    $('.lc-event').each((_, el) => {
      const link = $(el).find('a[aria-label^="View Details - "]').first();
      const aria = link.attr('aria-label');
      const href = link.attr('href');
      if (!aria || !href) return;
      const parsed = parseCityAria(aria);
      if (!parsed) return;
      const slug = href.replace(/^\/event\//, '').replace(/\/$/, '');
      if (bySlug.has(slug)) return;
      const venue = venueFromTitle(parsed.title);
      bySlug.set(slug, {
        source: 'citysb',
        title: parsed.title,
        venueName: venue,
        address: `${venue}, Santa Barbara, CA`,
        tier: 1,
        category: classifyCity(parsed.title),
        type: 'event',
        startISO: parsed.startISO,
        startStrategy: 'server_detail',
        priceLow: null,
        explicitlyFree: false,
        sourceUrl: `${ORIGIN}${href}`,
        buyUrl: `${ORIGIN}${href}`,
        raw: { slug },
      });
    });
    return [...bySlug.values()];
  },
};
