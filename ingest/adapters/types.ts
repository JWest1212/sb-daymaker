// ingest/adapters/types.ts
//
// Every source implements this one interface, so adding a source is mechanical
// and the worker (run.ts) stays generic. (Doc 11 §5.)

import type { RawCandidate } from '../../packages/shared/types';

export interface DateWindow {
  fromISO: string; // typically now
  toISO: string;   // typically now + 45 days
}

export interface SourceAdapter {
  key: string;    // 'ticketmaster' | 'soho' | ...
  label: string;  // 'Ticketmaster API' (shown in source-health)
  /**
   * Pull raw payloads and emit RawCandidates. MUST set startStrategy honestly:
   * 'structured' (machine field), 'server_detail' (explicit page time), or 'none'.
   * MUST NOT guess a time from prose, emit startStrategy:'none' and let the gate
   * drop it.
   */
  fetch(window: DateWindow): Promise<RawCandidate[]>;
  /**
   * Optional escape hatch (Phase 14): route this adapter's fetch through a managed
   * scraper (Scrapfly/Apify) only if the source starts blocking. Off by default.
   */
  useManagedScrape?: boolean;
}
