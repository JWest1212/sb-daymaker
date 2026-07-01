// ingest/adapters/alcazar.ts
//
// The Alcazar Theater — server-detail scrape (§7.4). Carpinteria anchor venue.
// thealcazar.org — WP Tribe REST → iCal → server-detail HTML scrape.
// useManagedScrape: false. Robots.txt checked at runtime.
//
// The Alcazar is a small community theater; ticket links are often direct (not AXS).
// buyUrl defaults to the detail page URL when no external ticket link is found.
//
// NOTE: As of 2026-06, thealcazar.org is an empty Squarespace shell — no event
// items are published in any Squarespace collection. All three resolution paths
// return 0 results correctly; this is not a scrape failure. Re-enable when the
// venue begins publishing events on the site.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';
import { sbISO } from '../tz';

// alcazartheater.com appears to redirect to thealcazar.org (per dedupe.ts rank pattern)
const BASE = 'https://www.thealcazar.org';
const SOURCE_KEY = 'alcazar';
const VENUE_NAME = 'The Alcazar Theater';
const VENUE_ADDRESS = '4916 Carpinteria Ave, Carpinteria, CA 93013';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/concert|music|band|jazz|rock|folk|country|pop/.test(t)) return 'live_music';
  if (/film|movie|cinema|screen/.test(t)) return 'arts_theater';
  if (/comedy|stand.?up/.test(t)) return 'arts_theater';
  if (/kids|family|children/.test(t)) return 'community_gathering';
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
    if (/\/(event|events|show|shows|film|films|calendar)\/[^/#?]+\/?$/.test(href)) {
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
  for (const path of ['/shows/', '/events/', '/calendar/', '/films/']) {
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
    const title = rawTitle.replace(/\s*[-|]\s*(The\s+)?Alcazar( Theater)?\s*$/i, '').trim();
    if (!title) continue;

    // External ticket URL if present; otherwise the detail page
    const ticketM = page.match(/href="(https?:\/\/(?:www\.)?(?:eventbrite|ticketweb|goldstar|etix|showclix)[^"]+)"/i);
    const buyUrl = ticketM?.[1] ?? url;

    const category = classifyTitle(title);
    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: 'carpinteria',
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

export const alcazar: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'The Alcazar Theater',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    // 1. WP Tribe REST
    const route = await discoverWpEventsRoute(BASE).catch(() => 'scrape' as const);
    if (route === 'tribe') {
      try {
        return await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'The Alcazar Theater',
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'carpinteria',
          tier: 1,
        });
      } catch { /* fall through */ }
    }

    // 2. iCal
    for (const icalUrl of [`${BASE}/events/?ical=1`, `${BASE}/calendar/?ical=1`, `${BASE}/shows/?ical=1`]) {
      try {
        return await parseIcsFeed(icalUrl, w, {
          sourceKey: SOURCE_KEY,
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'carpinteria',
          category: 'arts_theater',
          tier: 1,
        });
      } catch { /* try next */ }
    }

    // 3. Server-detail HTML scrape
    return scrapeVenue(w);
  },
};
