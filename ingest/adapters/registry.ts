// ingest/adapters/registry.ts
//
// Ordered list of active adapters. Order matters for dedupe's canonical-source
// preference (venue-owned ticketing wins over aggregators) — see dedupe.ts.
// Phase 10 ships the two reference adapters; Phases 13–14 append the rest.

import type { SourceAdapter } from './types';
import { ticketmaster } from './ticketmaster';
import { soho } from './soho';
import { independent } from './independent';

// Order matters for dedupe's canonical-source preference (venue-owned > aggregators).
// Deferred to the Phase-14 managed-scrape reserve: Visit SB (JS-rendered) and
// LiveNotes (inline, year-less dates). City of SB (Drupal) is a clean follow-on.
export const registry: SourceAdapter[] = [ticketmaster, soho, independent];
