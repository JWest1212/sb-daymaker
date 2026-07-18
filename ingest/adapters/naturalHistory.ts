// ingest/adapters/naturalHistory.ts
//
// Santa Barbara Museum of Natural History, WP Tribe REST → iCal → scrape (§7.2).
// Also emits a single Tier-3 culture_spot entry for the museum building itself
// (evergreen; idempotent via upsert on id conflict, per land.ts).
//
// The reasonToGo for the Tier-3 spot is a factual description of the institution, // NOT copied from the website (facts-only rule). Enrich never writes reasonToGo for
// Tier-3 spots that already carry one.
//
// sbnature.org, Robots.txt checked at runtime. useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { discoverWpEventsRoute, fetchTribeEvents } from './_shared/wpEvents';
import { parseIcsFeed } from './_shared/ics';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { extractEvents } from './_shared/jsonLd';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://www.sbnature.org';
const SOURCE_KEY = 'naturalHistory';
const VENUE_NAME = 'Santa Barbara Museum of Natural History';
const VENUE_ADDRESS = '2559 Puesta del Sol, Santa Barbara, CA 93105';

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/lecture|talk|discuss|film|screen/.test(t)) return 'arts_theater';
  if (/hike|walk|nature|outdoor/.test(t)) return 'sports_outdoors_event';
  if (/family|kids|children|youth|camp/.test(t)) return 'community_gathering';
  return 'community_gathering';
}

/** Scrape the events listing + detail pages (fallback when WP/iCal unavailable). */
async function scrapeEvents(w: { fromISO: string; toISO: string }): Promise<RawCandidate[]> {
  const fromTs = Date.parse(w.fromISO);
  const toTs = Date.parse(w.toISO);
  const out: RawCandidate[] = [];

  let listHtml = '';
  for (const path of ['/events/', '/calendar/', '/programs/']) {
    try {
      listHtml = await fetchHtmlPolite(`${BASE}${path}`, SOURCE_KEY);
      break;
    } catch { /* try next */ }
  }
  if (!listHtml) return [];

  // Collect event links
  const seen = new Set<string>();
  for (const m of listHtml.matchAll(/href="([^"]*\/(event|events|program)s?\/[^"#?]+)"/gi)) {
    const href = m[1];
    const url = href.startsWith('http') ? href : `${BASE}${href}`;
    seen.add(url.replace(/\/$/, ''));
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
    const title = rawTitle.replace(/\s*[-|]\s*Santa Barbara Museum of Natural History\s*$/i, '').trim();
    if (!title) continue;

    const category = classifyTitle(title);
    out.push({
      source: SOURCE_KEY,
      title,
      venueName: VENUE_NAME,
      address: VENUE_ADDRESS,
      neighborhood: 'mission_canyon',
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

/** The Tier-3 culture_spot for the museum building itself (evergreen). */
const MUSEUM_SPOT: RawCandidate = {
  source: SOURCE_KEY,
  title: VENUE_NAME,
  venueName: VENUE_NAME,
  address: VENUE_ADDRESS,
  neighborhood: 'mission_canyon',
  tier: 3,
  category: 'culture_spot',
  type: 'place',
  startStrategy: 'none',
  priceLow: null,
  explicitlyFree: false,
  sourceUrl: BASE,
  buyUrl: BASE,
  reasonToGo: 'One of California\'s leading regional natural history museums, with permanent galleries on Chumash heritage, paleontology, and local ecology set beside a seasonal creek in Mission Canyon.',
  occasionTags: seedOccasionTags({ category: 'culture_spot' }),
  raw: {},
};

export const naturalHistory: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'SB Museum of Natural History',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    let events: RawCandidate[] = [];

    // 1. WP Tribe REST
    const route = await discoverWpEventsRoute(BASE).catch(() => 'scrape' as const);
    if (route === 'tribe') {
      try {
        events = await fetchTribeEvents(BASE, w, {
          sourceKey: SOURCE_KEY,
          label: 'SB Museum of Natural History',
          venueName: VENUE_NAME,
          address: VENUE_ADDRESS,
          neighborhood: 'mission_canyon',
          tier: 1,
        });
      } catch { /* fall through */ }
    }

    // 2. iCal
    if (!events.length) {
      for (const icalUrl of [`${BASE}/events/?ical=1`, `${BASE}/calendar/?ical=1`]) {
        try {
          events = await parseIcsFeed(icalUrl, w, {
            sourceKey: SOURCE_KEY,
            venueName: VENUE_NAME,
            address: VENUE_ADDRESS,
            neighborhood: 'mission_canyon',
            category: 'community_gathering',
            tier: 1,
          });
          if (events.length) break;
        } catch { /* try next */ }
      }
    }

    // 3. HTML scrape fallback
    if (!events.length) {
      events = await scrapeEvents(w);
    }

    // Always append the evergreen Tier-3 spot (idempotent via upsert in land.ts)
    return [...events, MUSEUM_SPOT];
  },
};
