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
// Wave 1 adapters (§6)
import { sbbowl } from './sbbowl';
import { lobero } from './lobero';
import { ucsb } from './ucsb';
import { libraries } from './libraries';
import { farmersMarkets } from './farmersMarkets';

// Order matters for dedupe's canonical-source preference (venue-owned > aggregators
// > public submissions, which sit last so a real source wins a near-dupe).
// Wave 1 venue-direct adapters (sbbowl, lobero) follow existing venue-direct sources.
// ucsb/libraries/farmersMarkets are institutional; farmersMarkets is registry-only.
export const registry: SourceAdapter[] = [
  ticketmaster, soho, sbbowl, lobero, independent, citySites,
  ucsb, libraries, farmersMarkets,
  recurringRegistry, submissions,
];
