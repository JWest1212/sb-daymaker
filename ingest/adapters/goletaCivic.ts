// ingest/adapters/goletaCivic.ts
//
// City of Goleta civic calendar (§7.5). cityofgoleta.org.
// Resolution order: Localist API → CivicPlus iCal → HTML scrape.
//
// Filtered to public community events; internal council/admin minutiae are dropped
// via the DENY list. The City of SB is already covered by citysb; this adapter is
// net-new coverage for Goleta only.
//
// useManagedScrape: false. Robots.txt checked at runtime.
//
// NOTE: cityofgoleta.org is protected by Akamai edge security which blocks all
// automated requests (including browser UAs) from cloud/datacenter IPs. Returns 0
// from GitHub Actions runners. Enable useManagedScrape (Scrapfly) if coverage is
// needed; without it this adapter runs but yields nothing.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { fetchLocalist } from './_shared/localist';
import { parseIcsFeed } from './_shared/ics';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const SOURCE_KEY = 'goletaCivic';
const CITY_BASE = 'https://www.cityofgoleta.org';
const VENUE_NAME = 'City of Goleta';
const VENUE_ADDRESS = 'Goleta, CA 93117';

// Drop events matching these keywords (internal/admin noise)
const DENY: RegExp[] = [
  /\bcity council\b/i,
  /\bplanning commission\b/i,
  /\bboard\b.*\bmeeting\b/i,
  /\bcommittee\b.*\bmeeting\b/i,
  /\bpublic hearing\b/i,
  /\bworkshop\b.*\bstaff\b/i,
  /\btraining\b/i,
  /\belectron/i,
];

function isDenied(title: string): boolean {
  return DENY.some((rx) => rx.test(title));
}

/**
 * CivicPlus iCal export (common for California city websites).
 * Goleta likely uses CivicEngage/CivicPlus; the iCal URL follows a predictable pattern.
 */
const CIVIC_ICAL_URLS = [
  `${CITY_BASE}/calendar.aspx?CID=1&format=ical`,
  `${CITY_BASE}/ical/2.0/icalendar.aspx`,
  `${CITY_BASE}/government/calendar/?ical=1`,
];

async function tryCivicIcal(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  for (const url of CIVIC_ICAL_URLS) {
    try {
      const cands = await parseIcsFeed(url, w, {
        sourceKey: SOURCE_KEY,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: 'goleta',
        category: 'community_gathering',
        tier: 1,
      });
      const filtered = cands.filter((c) => !isDenied(c.title ?? ''));
      if (filtered.length > 0 || cands.length > 0) return filtered; // URL worked
    } catch { /* try next */ }
  }
  return [];
}

/** Generic HTML scrape fallback: look for event links on the calendar page. */
async function scrapeCalendar(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);
  const out: RawCandidate[] = [];

  let listHtml = '';
  for (const path of ['/calendar/', '/events/', '/government/calendar/']) {
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
    const title = (titleM?.[1] ?? ldEv?.name ?? '').replace(/\s*[-|]\s*City of Goleta\s*$/i, '').trim();
    if (!title || isDenied(title)) continue;

    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: 'goleta',
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

export const goletaCivic: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'City of Goleta',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    // 1. Localist API (if Goleta uses it — many CA cities do)
    try {
      const localistBase = 'https://events.cityofgoleta.org';
      const cands = await fetchLocalist(localistBase, w, {
        sourceKey: SOURCE_KEY,
        venueName: VENUE_NAME,
        address: VENUE_ADDRESS,
        neighborhood: 'goleta',
        tier: 1,
        denyKeywords: DENY,
      });
      if (cands.length) return cands;
    } catch { /* Localist not available; try next */ }

    // 2. CivicPlus iCal (standard California city CMS)
    const icalCands = await tryCivicIcal(w);
    if (icalCands.length) return icalCands;

    // 3. Generic HTML scrape fallback
    return scrapeCalendar(w);
  },
};
