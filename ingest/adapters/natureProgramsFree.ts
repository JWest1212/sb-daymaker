// ingest/adapters/natureProgramsFree.ts
//
// Free nature programs, registry candidates (§8.7).
// Tier 2 · recurring_outdoors · seed outdoors_active, free_sb, solo, family_day.
//
// Confirmed recurring programs (verified 2026-06-30):
//   Land Trust for SB County, Arroyo Hondo Preserve:
//     Open to the public on 1st and 3rd full weekends of each month.
//     Free docent-led hike at 10am on open Saturdays. Advance reservation required.
//     (sblandtrust.org/reserves/arroyo-hondo-preserve/, confirmed monthly rhythm)
//
//   Emitted as monthly registry candidate (day_of_week:6 = Saturday, frequency:'monthly').
//   The "1st/3rd Saturday" specificity can be captured in the recurringRegistry.ts
//   snippet the founder pastes after cockpit review.
//
// Sierra Club Los Padres: site uses Salesforce LWR (client-side rendered), not
// scrapable via plain fetch. No iCal feed. Excluded pending a direct URL.
//
// useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';
import { seedOccasionTags } from './_shared/occasionTags';

const SOURCE_KEY = 'natureProgramsFree';
const LAND_TRUST_URL = 'https://www.sblandtrust.org/reserves/arroyo-hondo-preserve/';

export const natureProgramsFree: SourceAdapter = {
  key: SOURCE_KEY,
  label: 'Nature Programs (Free)',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    return [
      {
        source: SOURCE_KEY,
        title: 'Arroyo Hondo Preserve, Docent-Led Guided Hike',
        venueName: 'Land Trust for SB County, Arroyo Hondo Preserve',
        address: '3001 Refugio Rd, Gaviota, CA 93117',
        neighborhood: 'goleta',
        tier: 2,
        category: 'recurring_outdoors',
        type: 'place',
        startStrategy: 'none',
        priceLow: null,
        explicitlyFree: true,
        sourceUrl: LAND_TRUST_URL,
        buyUrl: LAND_TRUST_URL,
        registryCandidate: true,
        // Open 1st and 3rd weekends monthly; docent hike at 10am Saturdays.
        // The monthly frequency signals the rhythm to the founder; the "1st/3rd"
        // specificity is captured in the recurringRegistry.ts snippet.
        recurring: [{ day_of_week: 6, start_time: '10:00', end_time: '12:00', frequency: 'monthly' }],
        occasionTags: seedOccasionTags({ category: 'recurring_outdoors' }),
        raw: { source: 'sblandtrust.org' },
      },
    ];
  },
};
