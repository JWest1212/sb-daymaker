// ingest/adapters/eventbrite.ts
//
// Eventbrite (SB), §8.1 planned server-rendered scrape.
//
// DOC MISMATCH (§8.1): Doc expected server-rendered HTML with /e/{slug} links.
// Reality: eventbrite.com uses React, the server delivers an empty shell; event
// cards are injected client-side. No /e/ URLs appear in the server response.
//
// Resolution: the Eventbrite API v3 (GET /v3/events/search/ with a free API key)
// is the correct approach. A free token is available at eventbrite.com/platform/api.
// Add secret EVENTBRITE_TOKEN to GitHub Actions and uncomment the implementation.
//
// useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';

export const eventbrite: SourceAdapter = {
  key: 'eventbrite',
  label: 'Eventbrite (SB)',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    // Client-rendered, plain fetch yields empty shell. Returns [] until
    // EVENTBRITE_TOKEN is wired and the API implementation is added.
    return [];
  },
};
