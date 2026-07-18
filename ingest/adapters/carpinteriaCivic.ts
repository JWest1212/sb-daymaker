// ingest/adapters/carpinteriaCivic.ts
//
// City of Carpinteria civic calendar (§7.5). carpinteriaca.gov.
// Resolution order: WP Tribe REST → HTML scrape.
//
// Investigation: site is WordPress + The Events Calendar (Tribe REST confirmed live
// at /wp-json/tribe/events/v1/events). Calendar is thin; even a handful of clean
// events per window is a net win over zero.
//
// Filtered to public community events; internal admin minutiae are dropped via
// the DENY list.
//
// useManagedScrape: false. Robots.txt checked at runtime.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { fetchTribeEvents } from './_shared/wpEvents';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const SOURCE_KEY = 'carpinteriaCivic';
const CITY_BASE = 'https://carpinteriaca.gov';
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
    // 1. WP Tribe REST (The Events Calendar, confirmed live at carpinteriaca.gov)
    try {
      const cands = await fetchTribeEvents(CITY_BASE, w, {
        sourceKey: SOURCE_KEY,
        label: VENUE_NAME,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: 'carpinteria',
        tier: 1,
      });
      const filtered = cands.filter((c) => !isDenied(c.title ?? ''));
      if (filtered.length || cands.length) return filtered;
    } catch { /* fall through */ }

    // 2. Generic HTML scrape fallback
    return scrapeCalendar(w);
  },
};
