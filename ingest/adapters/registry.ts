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
// Wave 2 adapters (§7)
import { granada } from './granada';
import { arlington } from './arlington';
import { moxi } from './moxi';
import { naturalHistory } from './naturalHistory';
import { botanicGarden } from './botanicGarden';
import { sbma } from './sbma';
import { musicacademy } from './musicacademy';
import { alcazar } from './alcazar';
import { goletaCivic } from './goletaCivic';
import { carpinteriaCivic } from './carpinteriaCivic';
import { downtownSB } from './downtownSB';

// Order mirrors SOURCE_PRIORITY in dedupe.ts:
//   ticketmaster → venue-direct → institution-direct → civic/curated → aggregators
//   → recurring registry → submissions
export const registry: SourceAdapter[] = [
  // structured ticketing API
  ticketmaster,
  // venue-direct (authoritative for their own events)
  soho, sbbowl, lobero, granada, arlington,
  musicacademy, alcazar,
  // institution-direct
  moxi, naturalHistory, botanicGarden, sbma,
  ucsb, libraries,
  // curated local listings / civic
  independent, citySites,
  goletaCivic, carpinteriaCivic,
  downtownSB,
  // registry-bound rhythms
  farmersMarkets,
  recurringRegistry, submissions,
];
