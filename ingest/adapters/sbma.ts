// ingest/adapters/sbma.ts
//
// Santa Barbara Museum of Art, WP Tribe REST → iCal → scrape (§7.2).
// Also emits a Tier-3 culture_spot for the museum building itself (evergreen).
//
// sbma.net, Robots.txt checked at runtime. useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://www.sbma.net';
const SOURCE_KEY = 'sbma';
const VENUE_NAME = 'Santa Barbara Museum of Art';
const VENUE_ADDRESS = '1130 State St, Santa Barbara, CA 93101';

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/film|screen|cinema/.test(t)) return 'arts_theater';
  if (/concert|music|performance|jazz/.test(t)) return 'live_music';
  if (/lecture|talk|gallery|opening|exhibit/.test(t)) return 'arts_theater';
  if (/family|kids|children|youth|workshop|class/.test(t)) return 'community_gathering';
  return 'arts_theater';
}

async function scrapeEvents(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);
  const out: RawCandidate[] = [];

  let listHtml = '';
  for (const path of ['/programs/', '/events/', '/calendar/', '/visit/programs/']) {
    try {
      listHtml = await fetchHtmlPolite(`${BASE}${path}`, SOURCE_KEY);
      break;
    } catch { /* try next */ }
  }
  if (!listHtml) return [];

  const seen = new Set<string>();
  for (const m of listHtml.matchAll(/href="([^"]*\/(event|events|program)s?\/[^"#?]+)"/gi)) {
    const href = m[1];
    seen.add((href.startsWith('http') ? href : `${BASE}${href}`).replace(/\/$/, ''));
  }

  for (const url of seen) {
    let page: string;
    try { page = await fetchHtmlPolite(url, SOURCE_KEY); }
    catch { continue; }

    const [ldEv] = extractEvents(page);
    const startISO: string | undefined = ldEv?.startDate ?? undefined;
    if (!startISO) continue;

    const ts = Date.parse(startISO);
    if (ts < fromTs || ts > toTs) continue;

    const titleM = page.match(/<meta[^>]+property="og:title"[^>]+content="([^"]+)"/i)
      ?? page.match(/<meta[^>]+content="([^"]+)"[^>]+property="og:title"/i);
    const rawTitle = titleM?.[1] ?? ldEv?.name ?? '';
    const title = rawTitle
      .replace(/\s*[-|]\s*Santa Barbara Museum of Art\s*$/i, '')
      .replace(/\s*[-|]\s*SBMA\s*$/i, '')
      .trim();
    if (!title) continue;

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
      startStrategy: 'structured',
      priceLow: ldEv?.offersLow ?? null,
      explicitlyFree: ldEv?.isFree ?? false,
      sourceUrl: url,
      buyUrl: url,
      occasionTags: seedOccasionTags({ category, text: title }),
      raw: { url },
    });
  }
  return out;
}

const MUSEUM_SPOT: RawCandidate = {
  source: SOURCE_KEY,
  title: VENUE_NAME,
  venueName: VENUE_NAME,
  address: VENUE_ADDRESS,
  neighborhood: 'downtown',
  tier: 3,
  category: 'culture_spot',
  type: 'place',
  startStrategy: 'none',
  priceLow: null,
  explicitlyFree: false,
  sourceUrl: BASE,
  buyUrl: BASE,
  reasonToGo: 'Santa Barbara\'s civic art museum on State Street, housing a permanent collection of European masters, Asian decorative arts, and California moderns in a Spanish Colonial Revival landmark.',
  occasionTags: seedOccasionTags({ category: 'culture_spot' }),
  raw: {},
};

export const sbma: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'SB Museum of Art',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    let events: RawCandidate[] = [];

    const route = await discoverWpEventsRoute(BASE).catch(() => 'scrape' as const);
    if (route === 'tribe') {
      try {
        events = await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'SB Museum of Art',
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'downtown',
          tier: 1,
        });
      } catch { /* fall through */ }
    }

    if (!events.length) {
      for (const icalUrl of [`${BASE}/events/?ical=1`, `${BASE}/calendar/?ical=1`, `${BASE}/programs/?ical=1`]) {
        try {
          events = await parseIcsFeed(icalUrl, w, {
            sourceKey: SOURCE_KEY,
            venueName: VENUE_NAME,
            address: VENUE_ADDRESS,
            neighborhood: 'downtown',
            category: 'arts_theater',
            tier: 1,
          });
          if (events.length) break;
        } catch { /* try next */ }
      }
    }

    if (!events.length) {
      events = await scrapeEvents(w);
    }

    return [...events, MUSEUM_SPOT];
  },
};
