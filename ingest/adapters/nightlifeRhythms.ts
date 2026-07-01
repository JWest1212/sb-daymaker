// ingest/adapters/nightlifeRhythms.ts
//
// SB nightlife recurring rhythms — registry candidates (§8.2).
// Tier 2 · recurring_nightlife · seed nightlife, date_night, solo, free_sb.
//
// Only schedules published directly on each venue's own website are included.
// Instagram-only nights are out of scope (per §1 and §8.2 build doc).
//
// Confirmed published schedules (verified 2026-06-30):
//   Figueroa Mountain Brewing (Funk Zone, 137 Anacapa St):
//     Tuesdays 7pm — Head Games Trivia (published at figmtnbrew.com/santabarbara)
//     Fridays 7–10pm — Live music
//     Saturdays 7–10pm — Live music
//   Dargan's Irish Pub (18 E Ortega St):
//     Tuesdays 9pm–1am — Karaoke (darganssb.com/karaoke)
//     Thursdays 9pm–1am — Karaoke
//
// Out of scope (Instagram-only or schedule not on venue website):
//   Brass Bear Brewing, Wine Therapy SB, Hotel Californian, Validation Ale
//   (Validation Ale has an artist-by-artist events calendar, not a fixed slot.)
//
// useManagedScrape: false. Schedules are hardcoded (stable; no scrape needed).

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { seedOccasionTags } from './_shared/occasionTags';

const SOURCE_KEY = 'nightlifeRhythms';
const FIGMTN_BASE = 'https://www.figmtnbrew.com/santabarbara';
const DARGANS_BASE = 'https://www.darganssb.com';

function rhythm(
  title: string,
  venueName: string,
  address: string,
  neighborhood: RawCandidate['neighborhood'],
  sourceUrl: string,
  day_of_week: number,  // 0=Sun, 1=Mon, …, 6=Sat
  start_time: string,   // HH:MM
  end_time: string,     // HH:MM
  category: RawCandidate['category'],
  explicitlyFree: boolean,
): RawCandidate {
  return {
    source: SOURCE_KEY,
    title,
    venueName,
    address,
    neighborhood,
    tier: 2,
    category,
    type: 'place',
    startStrategy: 'none',
    priceLow: null,
    explicitlyFree,
    sourceUrl,
    buyUrl: sourceUrl,
    registryCandidate: true,
    recurring: [{ day_of_week, start_time, end_time, frequency: 'weekly' }],
    occasionTags: seedOccasionTags({ category }),
    raw: { day_of_week, start_time },
  };
}

export const nightlifeRhythms: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Nightlife Rhythms',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    return [
      // Figueroa Mountain Brewing — Funk Zone, SB
      rhythm(
        'Head Games Trivia Night — Figueroa Mountain Brewing',
        'Figueroa Mountain Brewing Co. (Funk Zone)',
        '137 Anacapa St, Santa Barbara, CA 93101',
        'waterfront',
        FIGMTN_BASE,
        2,        // Tuesday
        '19:00', '21:00',
        'recurring_nightlife',
        true,     // free per venue listing
      ),
      rhythm(
        'Live Music — Figueroa Mountain Brewing',
        'Figueroa Mountain Brewing Co. (Funk Zone)',
        '137 Anacapa St, Santa Barbara, CA 93101',
        'waterfront',
        FIGMTN_BASE,
        5,        // Friday
        '19:00', '22:00',
        'recurring_nightlife',
        true,
      ),
      rhythm(
        'Live Music — Figueroa Mountain Brewing',
        'Figueroa Mountain Brewing Co. (Funk Zone)',
        '137 Anacapa St, Santa Barbara, CA 93101',
        'waterfront',
        FIGMTN_BASE,
        6,        // Saturday
        '19:00', '22:00',
        'recurring_nightlife',
        true,
      ),
      // Dargan's Irish Pub
      rhythm(
        "Karaoke Night — Dargan's Irish Pub",
        "Dargan's Irish Pub",
        '18 E Ortega St, Santa Barbara, CA 93101',
        'downtown',
        `${DARGANS_BASE}/karaoke`,
        2,        // Tuesday
        '21:00', '23:59',
        'recurring_nightlife',
        false,
      ),
      rhythm(
        "Karaoke Night — Dargan's Irish Pub",
        "Dargan's Irish Pub",
        '18 E Ortega St, Santa Barbara, CA 93101',
        'downtown',
        `${DARGANS_BASE}/karaoke`,
        4,        // Thursday
        '21:00', '23:59',
        'recurring_nightlife',
        false,
      ),
    ];
  },
};
