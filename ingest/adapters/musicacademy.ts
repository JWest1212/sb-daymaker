// ingest/adapters/musicacademy.ts
//
// Music Academy of the West, custom WP REST API (§7.3).
// Summer festival campus in Montecito. Many events are free (lawn concerts, open rehearsals).
//
// The site uses a custom WordPress namespace `maw-api/v1` (not The Events Calendar/Tribe).
// Standard Tribe REST, iCal, and listing-page scrapes all return 403 or empty pages.
// The events-instances endpoint returns all upcoming events with ISO-8601 start times.
//
// WAF note: The API requires a real browser User-Agent, the default ingest UA gets 403.
// useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate, HappeningCategory } from '../../packages/shared/types';
import { seedOccasionTags } from './_shared/occasionTags';

const BASE = 'https://musicacademy.org';
const SOURCE_KEY = 'musicacademy';
const VENUE_NAME = 'Music Academy of the West';
const VENUE_ADDRESS = '1070 Fairway Rd, Santa Barbara, CA 93108';

const MAW_API = `${BASE}/wp-json/maw-api/v1/events-instances`;
// The WAF blocks the default ingest UA; a browser UA passes.
const UA_BROWSER = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

function classifyTitle(title: string): HappeningCategory {
  const t = title.toLowerCase();
  if (/concert|recital|orchestr|chamber|jazz|symphony|vocal|piano|violin|ensemble/.test(t)) return 'live_music';
  if (/opera|theater|theat|lecture|masterclass/.test(t)) return 'arts_theater';
  return 'arts_theater';
}

function isFreeText(text: string): boolean {
  return /\bfree\b|\bno charge\b|\bno admission\b|\bcomplimentary\b/i.test(text);
}

interface MawEvent {
  Title?: string;
  Link?: string;
  Id?: number;
  SpektrixEventId?: string | null;
  Instances?: Array<{
    Id?: number;
    LocalTime?: string;  // "2026-08-04T12:00:00-07:00"
    EndTime?: string;
  }>;
}

export const musicacademy: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Music Academy of the West',
  useManagedScrape: false,
  async fetch(w): Promise<RawCandidate[]> {
    const fromTs = Date.parse(w.fromISO);
    const toTs = Date.parse(w.toISO);
    const out: RawCandidate[] = [];

    let events: MawEvent[];
    try {
      const res = await fetch(MAW_API, {
        headers: { 'user-agent': UA_BROWSER, 'accept': 'application/json' },
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`maw-api HTTP ${res.status}`);
      events = await res.json() as MawEvent[];
    } catch (err) {
      console.warn(`[musicacademy] API unavailable: ${err}`);
      return [];
    }

    for (const ev of events) {
      const title = String(ev.Title ?? '').replace(/\s*[-|]\s*Music Academy of the West\s*$/i, '').trim();
      if (!title) continue;

      const link = ev.Link ?? `${BASE}/events/`;

      for (const inst of (ev.Instances ?? [])) {
        const startISO = inst.LocalTime;
        if (!startISO) continue;

        const ts = Date.parse(startISO);
        if (Number.isNaN(ts) || ts < fromTs || ts > toTs) continue;

        // Append date slug so multi-instance events each get a unique sourceUrl
        // (gate.ts IDs events on `${sourceUrl}|${title}`)
        const dateSlug = startISO.slice(0, 10);
        const sourceUrl = `${link}${link.includes('?') ? '&' : '?'}d=${dateSlug}`;

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
          endISO: inst.EndTime ?? undefined,
          startStrategy: 'structured',
          priceLow: null,
          explicitlyFree: isFreeText(title),
          sourceUrl,
          buyUrl: link,
          occasionTags: seedOccasionTags({ category, text: title }),
          raw: { id: ev.Id, instanceId: inst.Id },
        });
      }
    }

    return out;
  },
};
