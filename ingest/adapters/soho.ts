// ingest/adapters/soho.ts
//
// The server-rendered long-tail pattern (Doc 11 §5b). SOhO's ticketing site lists
// every show server-side with title + an explicit clock time + a /e/<slug> detail
// link, so we parse the LISTING page directly (one request) rather than crawling
// every detail page. The explicit, server-rendered time -> startStrategy:'server_detail'.
// If a card has no parseable clock time, we emit 'none' and let the gate drop it —
// we NEVER guess a time from prose.

import * as cheerio from 'cheerio';
import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { sbISO } from '../tz';

const ORIGIN = 'https://tickets.sohosb.com';
const SOHO_ADDRESS = '1221 State St, Santa Barbara, CA 93101';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "Thursday, Jun 25, 2026 at 8:30 PM" / "... from 9:00 PM to ..." -> ISO, or null. */
export function parseShowDateTime(text: string): string | null {
  const m = text.match(
    /[A-Za-z]+,\s*([A-Za-z]{3,9})\.?\s+(\d{1,2}),\s+(\d{4})\s+(?:at|from)\s+(\d{1,2}):(\d{2})\s*([AP]M)/i,
  );
  if (!m) return null;
  const month = MONTHS[m[1].slice(0, 3).toLowerCase()];
  if (!month) return null;
  const day = Number(m[2]);
  const year = Number(m[3]);
  let hour = Number(m[4]) % 12;
  if (m[6].toUpperCase() === 'PM') hour += 12;
  return sbISO(year, month, day, hour, Number(m[5]));
}

interface RawShow { slug: string; title: string; dateText: string; }

/** Parse the listing HTML into one entry per show (dedupes the grid/list copies). */
export function extractShows(html: string): RawShow[] {
  const $ = cheerio.load(html);
  const bySlug = new Map<string, RawShow>();
  $('.event-card').each((_, el) => {
    const $card = $(el);
    const href = $card.find('a[href^="/e/"]').first().attr('href') ?? '';
    const slug = href.replace(/^\/e\//, '').replace(/\/tickets$/, '').replace(/\/$/, '');
    if (!slug) return;
    const aria = $card.find('[aria-label^="Tickets - "]').first().attr('aria-label') ?? '';
    const title = aria.replace(/^Tickets - /, '').trim();
    const dateText = $card.text().replace(/\s+/g, ' ').trim();
    if (!bySlug.has(slug)) bySlug.set(slug, { slug, title, dateText });
  });
  return [...bySlug.values()];
}

async function get(url: string): Promise<string> {
  const headers = { 'user-agent': 'SBDaymaker-ingest/1.0 (+https://www.sbdaymaker.com)' };
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`SOhO ${res.status}`);
      return await res.text();
    } catch (err) {
      if (attempt === 1) throw err;
    }
  }
  throw new Error('unreachable');
}

export const soho: SourceAdapter = {
  key: 'soho',
  label: 'SOhO ticketing',
  async fetch(): Promise<RawCandidate[]> {
    const html = await get(`${ORIGIN}/`);
    return extractShows(html).map((s): RawCandidate => {
      const startISO = parseShowDateTime(s.dateText) ?? undefined;
      const detailUrl = `${ORIGIN}/e/${s.slug}`;
      return {
        source: 'soho',
        title: s.title,
        venueName: 'SOhO Restaurant & Music Club',
        address: SOHO_ADDRESS,
        tier: 1,
        // Coarse default; the cockpit + enrich step refine non-music shows.
        category: 'live_music',
        type: 'event',
        startISO,
        startStrategy: startISO ? 'server_detail' : 'none',
        priceLow: null,            // SOhO listing doesn't publish a price
        explicitlyFree: false,
        sourceUrl: detailUrl,
        buyUrl: `${detailUrl}/tickets`,
        raw: { slug: s.slug, dateText: s.dateText },
      };
    });
  },
};
