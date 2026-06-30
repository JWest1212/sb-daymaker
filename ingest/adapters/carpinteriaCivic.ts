// ingest/adapters/carpinteriaCivic.ts
//
// City of Carpinteria civic calendar (§7.5). carpinteria.ca.us.
// Resolution order: CivicPlus iCal → Localist API → HTML scrape.
//
// Filtered to public community events; internal admin minutiae are dropped via
// the DENY list. Carpinteria is a thin-coverage city; even a handful of clean
// events per window is a net win over zero.
//
// useManagedScrape: false. Robots.txt checked at runtime.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { fetchLocalist } from './_shared/localist';
import { parseIcsFeed } from './_shared/ics';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const SOURCE_KEY = 'carpinteriaCivic';
const CITY_BASE = 'https://www.carpinteria.ca.us';
const VENUE_NAME = 'City of Carpinteria';
const VENUE_ADDRESS = 'Carpinteria, CA 93013';

const DENY: RegExp[] = [
  /\bcity council\b/i,
  /\bplanning commission\b/i,
  /\bboard\b.*\bmeeting\b/i,
  /\bcommittee\b.*\bmeeting\b/i,
  /\bpublic hearing\b/i,
  /\bworkshop\b.*\bstaff\b/i,
  /\btraining\b/i,
];

function isDenied(title: string): boolean {
  return DENY.some((rx) => rx.test(title));
}

const CIVIC_ICAL_URLS = [
  `${CITY_BASE}/calendar.aspx?CID=1&format=ical`,
  `${CITY_BASE}/ical/2.0/icalendar.aspx`,
  `${CITY_BASE}/government/calendar/?ical=1`,
  `${CITY_BASE}/calendar/?ical=1`,
];

async function tryCivicIcal(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  for (const url of CIVIC_ICAL_URLS) {
    try {
      const cands = await parseIcsFeed(url, w, {
        sourceKey: SOURCE_KEY,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: 'carpinteria',
        category: 'community_gathering',
        tier: 1,
      });
      const filtered = cands.filter((c) => !isDenied(c.title ?? ''));
      if (filtered.length > 0 || cands.length > 0) return filtered;
    } catch { /* try next */ }
  }
  return [];
}

async function scrapeCalendar(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);
  const out: RawCandidate[] = [];

  let listHtml = '';
  for (const path of ['/calendar/', '/events/', '/government/calendar/', '/recreation/events/']) {
    try {
      listHtml = await fetchHtmlPolite(`${CITY_BASE}${path}`, SOURCE_KEY);
      break;
    } catch { /* try next */ }
  }
  if (!listHtml) return [];

  const $ = cheerio.load(listHtml);
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/\/(event|calendar|activity)\/[^/#?]+/i.test(href) || /CID=\d/.test(href)) {
      const url = href.startsWith('http') ? href : `${CITY_BASE}${href}`;
      seen.add(url);
    }
  });

  for (const url of seen) {
    let page: string;
    try { page = await fetchHtmlPolite(url, SOURCE_KEY); }
    catch { continue; }

    const [ldEv] = extractEvents(page);
    const startISO = ldEv?.startDate;
    if (!startISO) continue;
    const ts = Date.parse(startISO);
    if (ts < fromTs || ts > toTs) continue;

    const titleM = page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
    const title = (titleM?.[1] ?? ldEv?.name ?? '').replace(/\s*[-|]\s*City of Carpinteria\s*$/i, '').trim();
    if (!title || isDenied(title)) continue;

    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: 'carpinteria',
      tier: 1,
      category: 'community_gathering',
      type: 'event',
      startISO,
      endISO: ldEv?.endDate ?? undefined,
      startStrategy: 'structured',
      priceLow: null,
      explicitlyFree: true,
      sourceUrl: url,
      buyUrl: url,
      occasionTags: seedOccasionTags({ category: 'community_gathering', text: title }),
      raw: { url },
    });
  }
  return out;
}

export const carpinteriaCivic: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'City of Carpinteria',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    // 1. CivicPlus iCal (Carpinteria uses CivicEngage — try first)
    const icalCands = await tryCivicIcal(w);
    if (icalCands.length) return icalCands;

    // 2. Localist API (if available)
    try {
      const cands = await fetchLocalist('https://events.carpinteria.ca.us', w, {
        sourceKey: SOURCE_KEY,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: 'carpinteria',
        tier: 1,
        denyKeywords: DENY,
      });
      if (cands.length) return cands;
    } catch { /* not a Localist instance */ }

    // 3. Generic HTML scrape fallback
    return scrapeCalendar(w);
  },
};
