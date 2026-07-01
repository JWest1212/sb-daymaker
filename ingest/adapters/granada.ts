// ingest/adapters/granada.ts
//
// The Granada Theatre — server-detail scrape (§7.1). Mirrors the Lobero pattern.
// Resolution order: WP Tribe REST → iCal → server-detail HTML scrape.
//
// Venue-direct rule: ticket links (AXS) become buyUrl. Never query AXS directly.
// useManagedScrape: false — plain fetch only.
//
// Robots.txt: checked at runtime via fetchHtmlPolite.
// Addresses resolved from gate.ts VENUE_ADDRESSES ('The Granada Theatre').
//
// NOTE: granadaSB.com is hosted by CIO Solutions on infrastructure that IP-blocks
// cloud runners (GitHub Actions / AWS ranges). This adapter returns 0 from CI; it
// may work from a residential or proxy IP. Enable useManagedScrape (Scrapfly) if
// coverage is needed in production.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';
import { sbISO } from '../tz';

const BASE = 'https://www.granadaSB.com';
const SOURCE_KEY = 'granada';
const VENUE_NAME = 'The Granada Theatre';
const VENUE_ADDRESS = '1214 State St, Santa Barbara, CA 93101';

// Common month names used in detail-page date strings
const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/concert|music|band|jazz|symphony|orchestra|recital|choir|folk|rock|pop/.test(t)) return 'live_music';
  if (/comedy|stand.?up/.test(t)) return 'arts_theater';
  if (/dance|ballet|tango/.test(t)) return 'arts_theater';
  return 'arts_theater';
}

/**
 * Parse og:description for a datetime like "Monday, October 12, 2026 at 7:30 PM"
 * (same format Lobero uses — Granada is the same WP theme family).
 */
function parseOgDesc(desc: string): string | null {
  const m = desc.match(
    /\w+,\s+([A-Za-z]+)\s+(\d{1,2}),\s+(\d{4})\s+at\s+(\d{1,2}):(\d{2})\s*([AP]M)/i,
  );
  if (!m) return null;
  const month = MONTHS[m[1].toLowerCase()];
  if (!month) return null;
  let hour = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'PM') hour += 12;
  return sbISO(Number(m[3]), month, Number(m[2]), hour, Number(m[5]));
}

/** Extract /events/{slug} hrefs from a listing page, de-duplicated. */
function extractEventUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    // Match /events/{slug}, /event/{slug}, /show/{slug}, /shows/{slug}
    if (/\/(event|events|show|shows|calendar)\/[^/#?]+\/?$/.test(href)) {
      seen.add(href.replace(/\/$/, ''));
    }
  });
  return [...seen].map((h) => (h.startsWith('http') ? h : `${BASE}${h}`));
}

/** Scrape the listing page, then fetch each detail page for the canonical time. */
async function scrapeVenue(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);
  const out: RawCandidate[] = [];

  // Try common listing paths
  let listHtml = '';
  for (const path of ['/events/', '/calendar/', '/shows/']) {
    try {
      listHtml = await fetchHtmlPolite(`${BASE}${path}`, SOURCE_KEY);
      break;
    } catch { /* try next */ }
  }
  if (!listHtml) return [];

  const urls = extractEventUrls(listHtml);

  for (const url of urls) {
    let page: string;
    try { page = await fetchHtmlPolite(url, SOURCE_KEY); }
    catch { continue; }

    // Prefer JSON-LD (structured) over og:description (server_detail)
    const [ldEv] = extractEvents(page);
    const startISO: string | undefined = ldEv?.startDate
      ?? (() => {
        const m = page.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i)
          ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:description"/i);
        return m ? parseOgDesc(m[1]) ?? undefined : undefined;
      })();

    if (startISO) {
      const ts = Date.parse(startISO);
      if (ts < fromTs || ts > toTs) continue;
    }

    // Title
    const titleM = page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
    const rawTitle = titleM?.[1] ?? ldEv?.name ?? '';
    const title = rawTitle.replace(/\s*[-|]\s*(The\s+)?Granada Theatre\s*$/i, '').trim();
    if (!title) continue;

    // Buy URL — first AXS or Ticketmaster link
    const buyM = page.match(/href="(https:\/\/(www\.axs\.com|www\.ticketmaster\.com)\/[^"]+)"/i);
    const buyUrl = buyM?.[1] ?? url;

    const category = classifyTitle(title);
    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: 'downtown',
      tier: 1,
      category,
      type: 'event',
      startISO,
      endISO: ldEv?.endDate ?? undefined,
      startStrategy: ldEv?.startDate ? 'structured' : (startISO ? 'server_detail' : 'none'),
      priceLow: ldEv?.offersLow ?? null,
      explicitlyFree: ldEv?.isFree ?? false,
      sourceUrl: url,
      buyUrl,
      occasionTags: seedOccasionTags({ category, text: title }),
      raw: { url },
    });
  }
  return out;
}

export const granada: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'The Granada Theatre',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    // 1. WP Tribe REST
    const route = await discoverWpEventsRoute(BASE).catch(() => 'scrape' as const);
    if (route === 'tribe') {
      try {
        return await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'The Granada Theatre',
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'downtown',
          tier: 1,
        });
      } catch { /* fall through */ }
    }

    // 2. iCal
    for (const icalUrl of [`${BASE}/events/?ical=1`, `${BASE}/calendar/?ical=1`]) {
      try {
        return await parseIcsFeed(icalUrl, w, {
          sourceKey: SOURCE_KEY,
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'downtown',
          category: 'arts_theater',
          tier: 1,
        });
      } catch { /* try next */ }
    }

    // 3. Server-detail HTML scrape
    return scrapeVenue(w);
  },
};
