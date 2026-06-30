// ingest/adapters/sbbowl.ts
//
// Santa Barbara Bowl — server-detail scrape (§6.1). Collects concert URLs from
// /concerts/, then fetches each detail page. Detail pages render date in
// .single-concerts__date--formatted ("Thursday, July 9, 2026") and start time
// in .single-concerts__time--formatted ("7:00 pm") → startStrategy:'server_detail'.
// buyUrl → AXS link from the page (venue-direct scrape, ticket link → buyUrl).
//
// Robots.txt: sbbowl.com returns 301 → no explicit Disallow found (2026-06-30).
// We treat as allowed and apply polite rate limiting.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { sbISO } from '../tz';
import { fetchHtmlPolite } from './_shared/fetchHtml';
import { seedOccasionTags } from './_shared/occasionTags';

const ORIGIN = 'https://sbbowl.com';
const LISTING = `${ORIGIN}/concerts/`;
const VENUE_ADDRESS = 'Santa Barbara Bowl, 1122 N Milpas St, Santa Barbara, CA 93103';

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * Parse "Thursday, July 9, 2026" + "7:00 pm" → ISO with SB local offset.
 * Returns null if either component is missing.
 */
export function parseBowlDateTime(dateText: string, timeText: string): string | null {
  const d = dateText.match(/\w+,\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/);
  const t = timeText.match(/(\d{1,2}):(\d{2})\s*([ap]m)/i);
  if (!d || !t) return null;
  const month = MONTHS[d[1].toLowerCase()];
  if (!month) return null;
  let hour = Number(t[1]) % 12;
  if (t[3].toLowerCase() === 'pm') hour += 12;
  return sbISO(Number(d[3]), month, Number(d[2]), hour, Number(t[2]));
}

/** Collect all /concerts/{slug} URLs from the shows listing, de-duplicated. */
export function extractBowlConcertUrls(html: string): string[] {
  const $ = cheerio.load(html);
  const seen = new Set<string>();
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') ?? '';
    if (/\/concerts\/[^/]+\/?$/.test(href)) seen.add(href.replace(/\/$/, '/'));
  });
  return [...seen].map((h) => (h.startsWith('http') ? h : `${ORIGIN}${h}`));
}

export const sbbowl: SourceAdapter = {
  key: 'sbbowl',
  label: 'Santa Barbara Bowl',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    const listHtml = await fetchHtmlPolite(LISTING, 'sbbowl', { skipRobots: true });
    const urls = extractBowlConcertUrls(listHtml);
    const out: RawCandidate[] = [];

    const fromTs = Date.parse(w.fromISO);
    const toTs = Date.parse(w.toISO);

    for (const url of urls) {
      let page: string;
      try { page = await fetchHtmlPolite(url, 'sbbowl', { skipRobots: true }); }
      catch { continue; }

      const $ = cheerio.load(page);

      const dateText = $('.single-concerts__date--formatted').first().text().trim();
      const timeText = $('.single-concerts__time--formatted').first().text().trim();
      const startISO = dateText && timeText ? parseBowlDateTime(dateText, timeText) ?? undefined : undefined;

      // Skip events outside window
      if (startISO) {
        const ts = Date.parse(startISO);
        if (ts < fromTs || ts > toTs) continue;
      }

      // Title from og:title, strip "- Santa Barbara Bowl" suffix
      const ogTitle = $('meta[property="og:title"]').attr('content') ?? '';
      const title = ogTitle.replace(/\s*[-|]\s*Santa Barbara Bowl\s*$/i, '').trim();
      if (!title) continue;

      // buyUrl → first AXS link on the page
      const axsLink = $('a[href*="axs.com"]').first().attr('href');
      const buyUrl = axsLink ?? url;

      // Category: live_music (Bowl is almost exclusively concerts)
      const category = 'live_music';

      out.push({
        source: 'sbbowl',
        title,
        venueName: 'Santa Barbara Bowl',
        address: VENUE_ADDRESS,
        neighborhood: 'upper_state',
        tier: 1,
        category,
        type: 'event',
        startISO,
        startStrategy: startISO ? 'server_detail' : 'none',
        priceLow: null,
        explicitlyFree: false,
        sourceUrl: url,
        buyUrl,
        occasionTags: seedOccasionTags({ category, text: title }),
        raw: { url },
      });
    }
    return out;
  },
};
