// ingest/adapters/outdoorsOperators.ts
//
// SB outdoor operator standing schedules, registry candidates (§8.3).
// Tier 2 · recurring_outdoors · seed outdoors_active, family_day, date_night, solo.
//
// Confirmed fixed public schedules (verified 2026-06-30):
//   Condor Express: 4.5-hr Whale Watch departs daily 10:00am from Sea Landing.
//     (condorexpress.com, structured booking calendar confirms daily 10am slot)
//   Ice in Paradise: multiple public-skate and specialty sessions
//     (iceinparadise.org/public-session, structured schedule page)
//
// SB Adventure Co: "book a time" on demand, no fixed weekly schedule published.
// Excluded per §1: no deterministic recurring time to emit.
//
// Condor Express is emitted as 7 weekly candidates (Mon–Sun) because it departs
// daily; each day-of-week entry generates one occurrence per week in the registry.
//
// useManagedScrape: false. Schedules are hardcoded (stable public schedules).

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { seedOccasionTags } from './_shared/occasionTags';

const SOURCE_KEY = 'outdoorsOperators';

function trip(
  title: string,
  venueName: string,
  address: string,
  neighborhood: RawCandidate['neighborhood'],
  sourceUrl: string,
  buyUrl: string,
  day_of_week: number,
  start_time: string,
  end_time: string,
  category: RawCandidate['category'],
  explicitlyFree: boolean,
  priceLow: number | null,
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
    priceLow,
    explicitlyFree,
    sourceUrl,
    buyUrl,
    registryCandidate: true,
    recurring: [{ day_of_week, start_time, end_time, frequency: 'weekly' }],
    occasionTags: seedOccasionTags({ category }),
    raw: { day_of_week, start_time },
  };
}

/** Emit one candidate per day-of-week for a daily departure. */
function dailyTrip(
  title: string,
  venueName: string,
  address: string,
  neighborhood: RawCandidate['neighborhood'],
  sourceUrl: string,
  buyUrl: string,
  start_time: string,
  end_time: string,
  category: RawCandidate['category'],
  explicitlyFree: boolean,
  priceLow: number | null,
): RawCandidate[] {
  return [0, 1, 2, 3, 4, 5, 6].map((dow) =>
    trip(title, venueName, address, neighborhood, sourceUrl, buyUrl,
      dow, start_time, end_time, category, explicitlyFree, priceLow),
  );
}

export const outdoorsOperators: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Outdoor Operators',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    const condorUrl = 'https://www.condorexpress.com/whale-watching';
    const condorAddress = '301 W Cabrillo Blvd, Santa Barbara, CA 93101';
    const iceUrl = 'https://www.iceinparadise.org/public-session';
    const iceAddress = '1021 Veronica Springs Rd, Santa Barbara, CA 93105';
    const iceVenue = 'Ice in Paradise (Las Positas Sports Complex)';

    return [
      // Condor Express, daily 10am whale watch (7 × weekly = daily coverage)
      ...dailyTrip(
        'Whale Watch, Condor Express',
        'Condor Express',
        condorAddress,
        'waterfront',
        condorUrl,
        'https://condorexpress.whalewatchreservations.com/cexsales2/',
        '10:00', '14:30',
        'recurring_outdoors',
        false,
        null,  // price varies by season; enrich can fill
      ),

      // Ice in Paradise, public skate sessions
      trip(
        'Public Skate, Ice in Paradise (Saturday PM)',
        iceVenue, iceAddress, 'upper_state', iceUrl, iceUrl,
        6,       // Saturday
        '13:30', '16:30',
        'recurring_outdoors', false, null,
      ),
      trip(
        'Public Skate, Ice in Paradise (Sunday PM)',
        iceVenue, iceAddress, 'upper_state', iceUrl, iceUrl,
        0,       // Sunday
        '13:30', '15:30',
        'recurring_outdoors', false, null,
      ),
      trip(
        'Friday Night Ice Jam, Ice in Paradise',
        iceVenue, iceAddress, 'upper_state', iceUrl, iceUrl,
        5,       // Friday
        '18:00', '20:00',
        'recurring_outdoors', false, null,
      ),
      trip(
        'College Night, Ice in Paradise',
        iceVenue, iceAddress, 'upper_state', iceUrl, iceUrl,
        2,       // Tuesday
        '20:00', '22:15',
        'recurring_outdoors', false, null,
      ),
    ];
  },
};
