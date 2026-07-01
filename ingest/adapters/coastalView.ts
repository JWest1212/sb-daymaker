// ingest/adapters/coastalView.ts
//
// Coastal View News — Carpinteria/SB local events (§8.6).
//
// DOC MISMATCH (§8.6): Doc assumed scrape-able HTML at coastalview.com/local-events/.
// Reality: the page loads events via the Evvnt third-party discovery widget
// (evvnt.com JS, publisher ID coastalview.com). The server delivers only an empty
// #evvnt-calendar-975407 div — no event data in the server response.
//
// Resolution: either (a) headless browser rendering, or (b) Evvnt publisher API
// with coastalview.com's publisher credentials. Neither is available without
// additional setup. Returns [] until addressed.
//
// useManagedScrape: false.

import type { SourceAdapter } from './types';
import type { RawCandidate } from '../../packages/shared/types';

export const coastalView: SourceAdapter = {
  key: 'coastalView',
  label: 'Coastal View',
  useManagedScrape: false,
  async fetch(): Promise<RawCandidate[]> {
    // Evvnt widget renders client-side — plain fetch yields no event data.
    return [];
  },
};
