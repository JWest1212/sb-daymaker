// ingest/adapters/independent.ts
//
// The Santa Barbara Independent events calendar (independent.com/events) — a
// server-rendered WordPress "Events" listing. Each card carries an explicit
// .event-date + .event-time (server_detail), a detail URL, and a location.
// Cards with no clock time emit startStrategy:'none' and the gate drops them.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { sbISO } from '../tz';

const ORIGIN = 'https://www.independent.com';
const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "Sat, Jun 27" + "2:00 PM" -> ISO, inferring the year as the next upcoming one. */
export function parseIndependentDate(dateText: string, timeText: string): string | null {
  const d = dateText.match(/([A-Za-z]{3,9})\s+(\d{1,2})/);              // "Jun 27"
  const t = timeText.match(/(\d{1,2}):(\d{2})\s*([AP]M)/i);             // "2:00 PM"
  if (!d || !t) return null;
  const month = MONTHS[d[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  const day = Number(d[2]);
  let hour = Number(t[1]) % 12;
  if (t[3].toUpperCase() === 'PM') hour += 12;
  const now = new Date();
  let year = now.getUTCFullYear();
  // If the month/day already passed (by > a week) this year, it's next year.
  const guess = new Date(Date.UTC(year, month - 1, day));
  if (guess.getTime() < now.getTime() - 7 * 86_400_000) year += 1;
  return sbISO(year, month, day, hour, Number(t[2]));
}

/** Coarse category from the article's event-category-* classes. */
export function classifyIndependent(classList: string): HappeningCategory {
  const c = classList.toLowerCase();
  if (/music|concert|jazz|band/.test(c)) return 'live_music';
  if (/arts|theat|film|gallery|museum/.test(c)) return 'arts_theater';
  if (/wine|food|beer|culinary/.test(c)) return 'food_drink_event';
  if (/outdoors|recreation|hike|run|sport/.test(c)) return 'sports_outdoors_event';
  if (/festival|fair|market/.test(c)) return 'festival_fair';
  return 'community_gathering';
}

async function get(url: string): Promise<string> {
  const headers = { 'user-agent': 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)' };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`Independent ${res.status}`);
      return await res.text();
    } catch (err) { if (attempt === 1) throw err; }
  }
  throw new Error('unreachable');
}

export const independent: SourceAdapter = {
  key: 'independent',
  label: 'The Independent',
  async fetch(): Promise<RawCandidate[]> {
    const $ = cheerio.load(await get(`${ORIGIN}/events/`));
    const out: RawCandidate[] = [];
    $('article.events, article.type-events').each((_, el) => {
      const $a = $(el);
      const link = $a.find('h4.entry-title a').first();
      const title = link.text().trim();
      const sourceUrl = link.attr('href');
      if (!title || !sourceUrl) return;
      const dateText = $a.find('.event-date').first().text().trim();
      const timeText = $a.find('.event-time').first().text().trim();
      const location = $a.find('.event-location').first().text().replace(/\s+/g, ' ').trim();
      const startISO = parseIndependentDate(dateText, timeText) ?? undefined;
      out.push({
        source: 'independent',
        title,
        venueName: location || 'Santa Barbara',
        address: location ? `${location}, Santa Barbara, CA` : 'Santa Barbara, CA',
        tier: 1,
        category: classifyIndependent($a.attr('class') ?? ''),
        type: 'event',
        startISO,
        startStrategy: startISO ? 'server_detail' : 'none',
        priceLow: null,
        explicitlyFree: false,
        sourceUrl,
        buyUrl: sourceUrl,
        raw: { dateText, timeText },
      });
    });
    return out;
  },
};
