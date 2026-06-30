// ingest/adapters/arlington.ts
//
// Arlington Theatre — server-detail scrape (§7.1). Mirrors the Lobero/Granada pattern.
// Resolution order: WP Tribe REST → iCal → server-detail HTML scrape.
//
// Venue-direct rule: ticket links become buyUrl. useManagedScrape: false.
// Robots.txt: checked at runtime via fetchHtmlPolite.
// Address resolved from gate.ts VENUE_ADDRESSES ('Arlington Theatre').

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';
import { sbISO } from '../tz';

const BASE = 'https://thearlington.com';
const SOURCE_KEY = 'arlington';
const VENUE_NAME = 'Arlington Theatre';
const VENUE_ADDRESS = '1317 State St, Santa Barbara, CA 93101';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/concert|music|band|jazz|symphony|orchestra|recital|rock|pop|folk/.test(t)) return 'live_music';
  if (/film|movie|cinema|screening/.test(t)) return 'arts_theater';
  if (/comedy|stand.?up/.test(t)) return 'arts_theater';
  return 'arts_theater';
}

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

function extractEventUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/\/(event|events|show|shows|calendar)\/[^/#?]+\/?$/.test(href)) {
      seen.add(href.replace(/\/$/, ''));
    }
  });
  return [...seen].map((h) => (h.startsWith('http') ? h : `${BASE}${h}`));
}

async function scrapeVenue(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);
  const out: RawCandidate[] = [];

  let listHtml = '';
  for (const path of ['/events/', '/shows/', '/calendar/']) {
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

    const titleM = page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
    const rawTitle = titleM?.[1] ?? ldEv?.name ?? '';
    const title = rawTitle.replace(/\s*[-|]\s*(The\s+)?Arlington Theatre\s*$/i, '').trim();
    if (!title) continue;

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

export const arlington: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Arlington Theatre',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    // 1. WP Tribe REST
    const route = await discoverWpEventsRoute(BASE).catch(() => 'scrape' as const);
    if (route === 'tribe') {
      try {
        return await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'Arlington Theatre',
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
