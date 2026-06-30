// ingest/adapters/farmersMarkets.ts
//
// SB Certified Farmers' Market — five in-scope markets emitted as registry
// candidates (§6.4). Each run produces the same five proposals; the gate
// validates the recurring spec; dedupe checks isAlreadyInRegistry() so after
// the founder approves one market and pastes the snippet into recurringRegistry.ts,
// a second run drops it as registry_exists.
//
// DOC MISMATCH (§6.4 says "scrape sbfarmersmarket.org/markets/"): the site runs
// on Wix with client-side rendering. Plain HTTP returns only Wix boilerplate — no
// market schedule data. Code wins: schedules are hardcoded from the SB Certified
// Farmers Market's published programme (stable, verified 2026-06-30).
//
// DOC MISMATCH (§6.4 example uses type:'recurring'): ThingType does not include
// 'recurring'. Using 'place' — weekly markets have no single starts_at and the
// DB events_have_start constraint rejects type:'event' rows with starts_at:null.
//
// Robots.txt: Allow: / (Wix default, confirmed 2026-06-30).
//
// Five in-scope markets:
//   Saturday SB  — Saturdays 8:30am–1pm  — Santa Barbara & Cota, downtown
//   Tuesday SB   — Tuesdays  3pm–6:30pm  — Santa Barbara & Cota, downtown
//   Goleta       — Sundays   10am–2pm    — Camino Real Marketplace, Goleta
//   Montecito    — Fridays   8am–11:15am — Coast Village Rd, montecito
//   Carpinteria  — Thursdays 3pm–6:30pm  — Linden Ave, carpinteria

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { seedOccasionTags } from './_shared/occasionTags';

const SOURCE_URL = 'https://www.sbfarmersmarket.org/markets';

function market(
  title: string,
  venueName: string,
  address: string,
  neighborhood: RawCandidate['neighborhood'],
  day_of_week: number,    // 0=Sun
  start_time: string,     // HH:MM
  end_time: string,       // HH:MM
): RawCandidate {
  return {
    source: 'farmersMarkets',
    title,
    venueName,
    address,
    neighborhood,
    tier: 2,
    category: 'recurring_market',
    type: 'place',
    startStrategy: 'none',
    priceLow: null,
    explicitlyFree: true,
    sourceUrl: SOURCE_URL,
    buyUrl: SOURCE_URL,
    registryCandidate: true,
    recurring: [{ day_of_week, start_time, end_time, frequency: 'weekly' }],
    occasionTags: seedOccasionTags({ category: 'recurring_market' }),
    raw: { day_of_week, start_time, end_time },
  };
}

export const farmersMarkets: SourceAdapter = {
  key: 'farmersMarkets',
  label: 'SB Certified Farmers Markets',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    return [
      market(
        "Saturday Farmers' Market — Santa Barbara",
        "SB Certified Farmers' Market (Santa Barbara & Cota)",
        '1 W Cota St, Santa Barbara, CA 93101',
        'downtown',
        6, '08:30', '13:00',
      ),
      market(
        "Tuesday Farmers' Market — Santa Barbara",
        "SB Certified Farmers' Market (Santa Barbara & Cota)",
        '1 W Cota St, Santa Barbara, CA 93101',
        'downtown',
        2, '15:00', '18:30',
      ),
      market(
        "Sunday Farmers' Market — Goleta",
        "SB Certified Farmers' Market (Camino Real Marketplace)",
        '7986 Calle Real, Goleta, CA 93117',
        'goleta',
        0, '10:00', '14:00',
      ),
      market(
        "Friday Farmers' Market — Montecito",
        "SB Certified Farmers' Market (Coast Village Rd)",
        '1200 Coast Village Rd, Santa Barbara, CA 93108',
        'montecito',
        5, '08:00', '11:15',
      ),
      market(
        "Thursday Farmers' Market — Carpinteria",
        "SB Certified Farmers' Market (Linden Ave)",
        '800 Linden Ave, Carpinteria, CA 93013',
        'carpinteria',
        4, '15:00', '18:30',
      ),
    ];
  },
};
