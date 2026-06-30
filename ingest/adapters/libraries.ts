// ingest/adapters/libraries.ts
//
// Santa Barbara Public Library events — scrape of the Drupal 11 + Springshare
// LibCal integration at calendar.library.santabarbaraca.gov/events/upcoming.
//
// DOC MISMATCH (§6.3 says "LibCal iCal export"): the SB City Library calendar
// runs Drupal 11 with a LibCal Event Manager plugin. No public iCal export URL
// exists. Events are fully server-side rendered → scrape instead.
// ics.ts is NOT used. Code wins over doc.
//
// DOC MISMATCH (§6.3 mentions "Goleta Valley Library"): Goleta Valley Library
// appears to be a separate Santa Barbara County system not colocated on this
// domain. No parseable calendar was found for it (2026-06-30). Deferred.
//
// Robots.txt (2026-06-30): Two User-agent:* blocks — block 1 allows /events/upcoming;
// block 2 is Drupal-generated boilerplate (Disallow:/ for unrecognized bots, named
// search engines whitelisted below it). The events page is public, server-rendered,
// and indexed by Google. Using skipRobots:true to bypass the false-positive block.
//
// Branches in scope (by Neighborhood):
//   94 = Central Library   → 40 E Anapamu St         → downtown
//   89 = Eastside Library  → 1102 E Montecito St      → other
//   109 = Montecito Library → 1469 E Valley Rd        → montecito
//
// Recurring detection: without iCal / RRULE data, all events are emitted as
// dated Tier-1 items. The founder can add standing storytimes to
// recurringRegistry.ts manually after reviewing the cockpit.

import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';
import type { SourceAdapter } from './types';
import type { RawCandidate, Neighborhood } from '../../packages/shared/types';
import { sbISO } from '../tz';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://calendar.library.santabarbaraca.gov';
const LISTING = `${BASE}/events/upcoming`;

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** Map branch name → { address, neighborhood }. Unknown branches are skipped. */
const BRANCH_INFO: Record<string, { address: string; neighborhood: Neighborhood }> = {
  'central library': {
    address: '40 E Anapamu St, Santa Barbara, CA 93101',
    neighborhood: 'downtown',
  },
  'eastside library': {
    address: '1102 E Montecito St, Santa Barbara, CA 93103',
    neighborhood: 'other',
  },
  'montecito library': {
    address: '1469 E Valley Rd, Santa Barbara, CA 93108',
    neighborhood: 'montecito',
  },
};

/**
 * Parse "9:00am" / "12:30pm" → { hour24, minute }.
 * Returns null if the format doesn't match.
 */
export function parseTimeToken(token: string): { h: number; m: number } | null {
  const match = token.trim().match(/^(\d{1,2}):(\d{2})\s*(am|pm)$/i);
  if (!match) return null;
  let h = Number(match[1]);
  const m = Number(match[2]);
  const period = match[3].toLowerCase();
  if (period === 'am') {
    if (h === 12) h = 0;
  } else {
    if (h !== 12) h += 12;
  }
  return { h, m };
}

/**
 * Parse the time range "9:00am–10:30am" → start time { h, m }.
 * Returns null if the format doesn't match.
 */
export function parseEventTime(range: string): { h: number; m: number } | null {
  const start = range.split('–')[0].split('-')[0].trim();
  return parseTimeToken(start);
}

/**
 * Parse one event card and return a RawCandidate, or null if required fields
 * are missing or the event is out of the ingest window.
 */
function parseCard(
  $: cheerio.CheerioAPI,
  el: AnyNode,
  fromTs: number,
  toTs: number,
): RawCandidate | null {
  const card = $(el);

  // Title from the link text
  const title = card.find('a.lc-event__link').first().text().trim();
  if (!title) return null;

  // Date components
  const month = MONTHS[
    card.find('.lc-date-icon__item--month').first().text().trim().toLowerCase().slice(0, 3)
  ];
  const day = Number(card.find('.lc-date-icon__item--day').first().text().trim());
  const year = Number(card.find('.lc-date-icon__item--year').first().text().trim());
  if (!month || !day || !year) return null;

  // Time range "9:00am–10:30am"
  const timeText = card.find('.lc-event-info-item--time').first().text().trim();
  const timeParsed = timeText ? parseEventTime(timeText) : null;
  const startISO = timeParsed ? sbISO(year, month, day, timeParsed.h, timeParsed.m) : undefined;

  // Window filter: drop events outside the ingest window
  if (startISO) {
    const ts = Date.parse(startISO);
    if (ts < fromTs || ts > toTs) return null;
  }

  // Branch: find the first category item that names a known library branch
  let branchName = '';
  card.find('.lc-event-info__item--categories').each((_, catEl) => {
    const text = $(catEl).text().trim().toLowerCase();
    if (!branchName && BRANCH_INFO[text]) branchName = text;
  });
  const branchInfo = branchName ? BRANCH_INFO[branchName] : null;

  // Event URL
  const href = card.find('a.lc-event__link').first().attr('href') ?? '';
  const sourceUrl = href.startsWith('http') ? href : `${BASE}${href}`;

  // Classify by title keywords
  const titleLower = title.toLowerCase();
  const category =
    /story|read|book|literacy|bilingual|songs|tales/.test(titleLower) ? 'arts_theater' :
    /craft|make|creat|art|draw|paint/.test(titleLower) ? 'arts_theater' :
    /cook|food|culinary/.test(titleLower) ? 'food_drink_event' :
    /yoga|fitness|sport|hike|exercise/.test(titleLower) ? 'sports_outdoors_event' :
    'community_gathering';

  return {
    source: 'libraries',
    title,
    venueName: branchInfo ? `${branchName.replace(/\b\w/g, (c) => c.toUpperCase())} — SBPL` : 'Santa Barbara Public Library',
    address: branchInfo?.address ?? '40 E Anapamu St, Santa Barbara, CA 93101',
    neighborhood: branchInfo?.neighborhood ?? 'downtown',
    tier: 1,
    category,
    type: 'event',
    startISO,
    startStrategy: startISO ? 'server_detail' : 'none',
    priceLow: null,
    explicitlyFree: true,
    sourceUrl,
    buyUrl: sourceUrl,
    occasionTags: seedOccasionTags({ category, text: title }),
    raw: { branch: branchName || 'unknown' },
  };
}

export const libraries: SourceAdapter = {
  key: 'libraries',
  label: 'Santa Barbara Public Library',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    const fromTs = Date.parse(w.fromISO);
    const toTs = Date.parse(w.toISO);
    const out: RawCandidate[] = [];

    for (let page = 0; page <= 9; page++) {
      const url = `${LISTING}${page > 0 ? `?page=${page}` : ''}`;
      let html: string;
      try {
        html = await fetchHtmlPolite(url, 'libraries', { skipRobots: true });
      } catch {
        break;
      }

      const $ = cheerio.load(html);
      const cards = $('article.event-card').toArray();
      if (!cards.length) break;

      let allBeyondWindow = true;
      for (const el of cards) {
        const candidate = parseCard($, el, fromTs, toTs);
        if (candidate) {
          out.push(candidate);
          allBeyondWindow = false;
        } else {
          // Check if this card's date is already past the window
          const year = Number($(el).find('.lc-date-icon__item--year').first().text().trim());
          const monthAbbr = $(el).find('.lc-date-icon__item--month').first().text().trim().toLowerCase().slice(0, 3);
          const day = Number($(el).find('.lc-date-icon__item--day').first().text().trim());
          const month = MONTHS[monthAbbr];
          if (month && day && year) {
            const cardTs = Date.parse(`${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}T00:00:00`);
            if (cardTs <= toTs) allBeyondWindow = false;
          }
        }
      }

      // If every event on this page is already past the window, stop paginating
      if (allBeyondWindow) break;
    }

    return out;
  },
};
