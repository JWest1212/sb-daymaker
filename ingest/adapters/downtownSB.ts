// ingest/adapters/downtownSB.ts
//
// Downtown Santa Barbara events — server-rendered HTML scrape (§7.6).
// Source: downtownsb.org/happenings/
//
// Category map (§7.6):
//   "Concerts & Live Music" → live_music
//   "Art & Exhibits"        → arts_theater
//   "Dance"                 → arts_theater
//   "Family Friendly"       → community_gathering
//   "Theatre & Shows"       → arts_theater
//   "1st Thursdays"         → registry candidate (monthly, Thursday, ~5pm)
//   everything else         → community_gathering
//
// Dedupe note (§7.6): downtownSB re-lists venue-direct events (Lobero, Historical
// Museum, etc.). SOURCE_PRIORITY (dedupe.ts) makes venue-direct win; downtownSB
// catches venue-direct–less listings that no other adapter covers.
//
// 1st Thursdays is Santa Barbara's monthly gallery walk (first Thursday of every
// month, State Street area, typically 5–8pm). It is emitted as a registry
// candidate so the founder can paste it into recurringRegistry.ts. We use 17:00
// as the start_time since the event reliably starts at 5pm.
//
// Robots.txt: checked at runtime. useManagedScrape: false.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { seedOccasionTags } from './_shared/occasionTags';
import { isInScope } from './_shared/geoFilter';
import { sbISO } from '../tz';

const SOURCE_KEY = 'downtownSB';
const BASE = 'https://www.downtownsb.org';
const LISTING = `${BASE}/happenings/`;

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/** Map category strings from the Downtown SB site to our HappeningCategory. */
function mapCategory(cat: string): HappeningCategory {
  const c = cat.toLowerCase();
  if (/concert|live music/.test(c)) return 'live_music';
  if (/art|exhibit|gallery|dance|theatre|theater|show|perform/.test(c)) return 'arts_theater';
  if (/family/.test(c)) return 'community_gathering';
  if (/food|wine|culinary|drink/.test(c)) return 'food_drink_event';
  if (/festival|fair/.test(c)) return 'festival_fair';
  return 'community_gathering';
}

/**
 * Parse a date string like "July 3, 2026" + time "7:00 PM" → ISO.
 * Returns null if either component is missing or can't be parsed.
 */
function parseListingDateTime(dateStr: string, timeStr: string): string | null {
  // "July 3, 2026" or "Jul 3, 2026"
  const d = dateStr.match(/([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  if (!d) return null;
  const month = MONTHS[d[1].toLowerCase()];
  if (!month) return null;

  // "7:00 PM" or "7:00pm" or "7 PM"
  const t = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*([AP]M)/i);
  if (!t) return null;
  let hour = Number(t[1]) % 12;
  if (t[3].toUpperCase() === 'PM') hour += 12;
  const minute = t[2] ? Number(t[2]) : 0;

  return sbISO(Number(d[3]), month, Number(d[2]), hour, minute);
}

/** The 1st Thursdays registry candidate. We emit it with a fixed 17:00 start
 *  (the event always starts at 5pm; this is factual, not guessed). */
const FIRST_THURSDAY_CANDIDATE: RawCandidate = {
  source: SOURCE_KEY,
  title: '1st Thursdays — Downtown SB Gallery Walk',
  venueName: 'Downtown Santa Barbara (State Street)',
  address: '1 W Carrillo St, Santa Barbara, CA 93101',
  neighborhood: 'downtown',
  tier: 2,
  category: 'recurring_arts',
  type: 'place',
  startStrategy: 'none',
  priceLow: null,
  explicitlyFree: true,
  sourceUrl: `${BASE}/happenings/`,
  registryCandidate: true,
  recurring: [{ day_of_week: 4, start_time: '17:00', end_time: '20:00', frequency: 'monthly' }],
  occasionTags: seedOccasionTags({ category: 'recurring_arts' }),
  raw: {},
};

export const downtownSB: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Downtown Santa Barbara',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    const fromTs = Date.parse(w.fromISO);
    const toTs = Date.parse(w.toISO);
    const out: RawCandidate[] = [];

    // Try a few plausible listing URLs (the ?d=next30 param or plain /happenings/)
    let listHtml = '';
    for (const url of [
      `${LISTING}?d=next30`,
      `${LISTING}calendar?d=next30`,
      LISTING,
    ]) {
      try {
        listHtml = await fetchHtmlPolite(url, SOURCE_KEY);
        break;
      } catch { /* try next */ }
    }
    if (!listHtml) return [FIRST_THURSDAY_CANDIDATE]; // always emit registry candidate

    const $ = cheerio.load(listHtml);

    // Downtown SB renders events in .event-item / .happening-item / article.event style elements.
    // We look for common patterns: a date block, title link, category, time.
    const eventEls = $('article, .event-item, .event-listing, .happening, [class*="event"]').toArray();

    for (const el of eventEls) {
      const card = $(el);

      // Title — from the first link or heading
      const titleEl = card.find('h2, h3, h4, .event-title, .title, a').first();
      const rawTitle = titleEl.text().trim();
      if (!rawTitle) continue;

      // Category text
      const categoryText = card.find('[class*="categor"], [class*="tag"]').first().text().trim();

      // 1st Thursdays → registry candidate emitted below; skip from dated items
      if (/1st thursday|first thursday/i.test(rawTitle) || /1st thursday/i.test(categoryText)) {
        continue;
      }

      // Date and time strings
      const dateText = card.find('[class*="date"], time, [class*="when"]').first().text().trim();
      const timeText = card.find('[class*="time"]').first().text().trim()
        || card.text().match(/\d{1,2}(?::\d{2})?\s*[AP]M/i)?.[0] || '';

      const startISO = dateText && timeText ? parseListingDateTime(dateText, timeText) ?? undefined : undefined;

      if (startISO) {
        const ts = Date.parse(startISO);
        if (ts < fromTs || ts > toTs) continue;
      }

      // Link to event detail page
      const href = titleEl.is('a') ? (titleEl.attr('href') ?? '') : card.find('a').first().attr('href') ?? '';
      const sourceUrl = href ? (href.startsWith('http') ? href : `${BASE}${href}`) : LISTING;

      // Venue/address (optional — may not be present in listing view)
      const venueText = card.find('[class*="venue"], [class*="location"], [class*="address"]').first().text().trim();
      const address = venueText || 'Downtown Santa Barbara, CA 93101';
      const venueName = venueText || 'Downtown Santa Barbara';

      // Geo filter: drop anything the listing page shows that's outside our scope
      if (!isInScope({ address, venueName })) continue;

      const category = mapCategory(categoryText || rawTitle);
      out.push({
        source: SOURCE_KEY,
        title: rawTitle,
        venueName,
        address,
        neighborhood: 'downtown',
        tier: 1,
        category,
        type: 'event',
        startISO,
        startStrategy: startISO ? 'server_detail' : 'none',
        priceLow: null,
        explicitlyFree: /free/i.test(card.text()),
        sourceUrl,
        buyUrl: sourceUrl,
        occasionTags: seedOccasionTags({ category, text: rawTitle }),
        raw: { categoryText },
      });
    }

    // Always emit the 1st Thursday registry candidate (isAlreadyInRegistry dedupe drops
    // it once the founder pastes the snippet into recurringRegistry.ts)
    out.push(FIRST_THURSDAY_CANDIDATE);

    return out;
  },
};
