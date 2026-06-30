// ingest/adapters/musicacademy.ts
//
// Music Academy of the West — WP Tribe REST → iCal → server-detail scrape (§7.3).
// Summer festival campus in Montecito. Many events are free (lawn concerts, open
// rehearsals); where a page says "free" we set explicitlyFree:true.
// musicacademy.org — Robots.txt checked at runtime. useManagedScrape: false.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';
import { sbISO } from '../tz';

const BASE = 'https://musicacademy.org';
const SOURCE_KEY = 'musicacademy';
const VENUE_NAME = 'Music Academy of the West';
const VENUE_ADDRESS = '1070 Fairway Rd, Santa Barbara, CA 93108';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/concert|recital|orchestr|chamber|jazz|symphony|vocal|piano|violin|ensemble/.test(t)) return 'live_music';
  if (/opera|theater|theat|lecture|masterclass/.test(t)) return 'arts_theater';
  return 'arts_theater';
}

function isFreeText(text: string): boolean {
  return /\bfree\b|\bno charge\b|\bno admission\b|\bcomplimentary\b/i.test(text);
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
    if (/\/(event|events|concert|concerts|performance|performances)\/[^/#?]+\/?$/.test(href)) {
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
  for (const path of ['/events/', '/concerts/', '/calendar/', '/performances/']) {
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
    const title = rawTitle.replace(/\s*[-|]\s*Music Academy of the West\s*$/i, '').trim();
    if (!title) continue;

    const explicitlyFree = ldEv?.isFree ?? isFreeText(page.slice(0, 4000));
    const category = classifyTitle(title);

    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: 'montecito',
      tier: 1,
      category,
      type: 'event',
      startISO,
      endISO: ldEv?.endDate ?? undefined,
      startStrategy: ldEv?.startDate ? 'structured' : (startISO ? 'server_detail' : 'none'),
      priceLow: ldEv?.offersLow ?? null,
      explicitlyFree,
      sourceUrl: url,
      buyUrl: url,
      occasionTags: seedOccasionTags({ category, text: title }),
      raw: { url },
    });
  }
  return out;
}

export const musicacademy: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Music Academy of the West',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    // 1. WP Tribe REST
    const route = await discoverWpEventsRoute(BASE).catch(() => 'scrape' as const);
    if (route === 'tribe') {
      try {
        return await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'Music Academy of the West',
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'montecito',
          tier: 1,
        });
      } catch { /* fall through */ }
    }

    // 2. iCal
    for (const icalUrl of [`${BASE}/events/?ical=1`, `${BASE}/calendar/?ical=1`, `${BASE}/concerts/?ical=1`]) {
      try {
        return await parseIcsFeed(icalUrl, w, {
          sourceKey: SOURCE_KEY,
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'montecito',
          category: 'live_music',
          tier: 1,
        });
      } catch { /* try next */ }
    }

    // 3. Server-detail HTML scrape
    return scrapeVenue(w);
  },
};
