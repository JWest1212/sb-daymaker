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
// Wave 3 adapters (§8)
import { centerstage } from './centerstage';
import { carpinteriaArts } from './carpinteriaArts';
import { eventbrite } from './eventbrite';
import { coastalView } from './coastalView';
import { nightlifeRhythms } from './nightlifeRhythms';
import { outdoorsOperators } from './outdoorsOperators';
import { natureProgramsFree } from './natureProgramsFree';
// Wave 4 adapters (§9)
import { seatgeek } from './seatgeek';
import { sbcountyArts } from './sbcountyArts';
import { allevents } from './allevents';
import { newVic } from './newVic';
// Data Arch Redesign 25 — the generic AI extraction lane (one adapter, N `sources` rows)
import { generic } from './generic';

// Order mirrors SOURCE_PRIORITY in dedupe.ts:
//   ticketmaster → venue-direct → institution-direct → civic/curated → aggregators
//   → recurring registry → submissions
export const registry: SourceAdapter[] = [
  // structured ticketing API
  ticketmaster,
  // venue-direct (authoritative for their own events)
  soho, sbbowl, lobero, granada, arlington,
  musicacademy, alcazar, centerstage, carpinteriaArts, newVic,
  // institution-direct
  moxi, naturalHistory, botanicGarden, sbma,
  ucsb, libraries,
  // curated local listings / civic
  independent, citySites,
  goletaCivic, carpinteriaCivic,
  downtownSB, coastalView, sbcountyArts,
  // broad aggregators
  eventbrite, allevents, seatgeek,
  // registry-bound rhythms
  farmersMarkets,
  nightlifeRhythms, outdoorsOperators, natureProgramsFree,
  recurringRegistry, submissions,
  // generic AI extraction lane — runs last; each candidate's own resolved
  // source (by URL) carries its own authority/lane, so ordering here doesn't
  // affect dedupe preference (dedupe.ts sorts by sources.authority, not
  // registry position).
  generic,
];
