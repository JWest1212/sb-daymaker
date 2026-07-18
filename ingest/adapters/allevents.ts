// ingest/adapters/allevents.ts
//
// AllEvents.in (Santa Barbara / Goleta / Carpinteria), §9.3 planned scrape.
//
// DOC MISMATCH (§9.3): Doc expected server-rendered HTML with structured event data.
// Reality: allevents.in is a client-rendered React SPA. The server delivers an empty
// shell; event cards are injected client-side via JavaScript. No event data appears
// in the server response. No public API is documented.
//
// Resolution: Scrapfly with JS rendering would work, but useManagedScrape stays off
// (founder directive §1). Returning [] until a headless-browser path is available.
//
// useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';

export const allevents: SourceAdapter = {
  key: 'allevents',
  label: 'AllEvents (SB)',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    // Client-rendered, plain fetch yields empty shell. Returns [] until a
    // headless-browser path is available or a public API is discovered.
    return [];
  },
};
