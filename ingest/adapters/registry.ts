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
import { submissions } from './submissions';

// Order matters for dedupe's canonical-source preference (venue-owned > aggregators
// > public submissions, which sit last so a real source wins a near-dupe).
// Deferred to the Phase-14 managed-scrape reserve: Visit SB (JS-rendered) and
// LiveNotes (inline, year-less dates).
export const registry: SourceAdapter[] = [ticketmaster, soho, independent, citySites, submissions];
