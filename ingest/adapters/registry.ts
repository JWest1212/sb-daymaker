// ingest/adapters/registry.ts
//
// Ordered list of active adapters. Order matters for dedupe's canonical-source
// preference (venue-owned ticketing wins over aggregators) — see dedupe.ts.
// Phase 10 ships the two reference adapters; Phases 13–14 append the rest.

import type { SourceAdapter } from './types';
import { ticketmaster } from './ticketmaster';
import { soho } from './soho';
import { independent } from './independent';
import { citySites } from './citySites';
import { recurringRegistry } from './recurringRegistry';
import { submissions } from './submissions';

// Order matters for dedupe's canonical-source preference (venue-owned > aggregators
// > public submissions, which sit last so a real source wins a near-dupe).
// Visit SB (JS-rendered) + LiveNotes (year-less inline) can be switched on via the
// MANAGED_SCRAPE reserve when worth the spend.
export const registry: SourceAdapter[] = [
  ticketmaster, soho, independent, citySites, recurringRegistry, submissions,
];
