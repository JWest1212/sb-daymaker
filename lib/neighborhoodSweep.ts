// lib/neighborhoodSweep.ts
//
// Client-safe types for the Doc 19 Neighborhood Sweep. Server aggregation
// (service-role reads + the resolver) lives in lib/neighborhoodSweepServer.ts —
// same split as lib/coverage.ts / lib/coverageServer.ts.

import type { ResolveMethod } from "../ingest/adapters/_shared/resolveNeighborhood";
import type { DoorZoneKey } from "./doorZones";

export interface SweepMethodCount {
  method: ResolveMethod;
  count: number;
}

export interface SweepZoneCount {
  key: DoorZoneKey;
  label: string;
  count: number;
}

/** One thing the resolver could not confidently place (§4.2: confidence below
 *  0.75) — the Phase 3 triage queue's row shape. `suggestedZone`/`suggestedNeighborhood`
 *  are null when the resolver found nothing at all (method 'unresolved'). */
export interface SweepTriageItem {
  id: string;
  title: string;
  address: string | null;
  source: string | null;
  suggestedZone: DoorZoneKey | null;
  suggestedNeighborhood: string | null;
  confidence: number;
  method: ResolveMethod;
  /** A candidate venue name extracted from the address (same heuristic as the
   *  Card Imagery venue-pool seeding, lib/venuePool.ts's extractVenueNameFromAddress),
   *  offered as the default when a triage tap adds this to the dictionary. */
  venueNameGuess: string | null;
}

export interface SweepSummary {
  total: number;
  resolved: number;        // autoWrites() true — would auto-write, no review needed
  unresolved: number;      // autoWrites() false — a street-tier suggestion, or nothing at all
  autoResolveRate: number; // resolved / total, 0 when total is 0
  byMethod: SweepMethodCount[];
  /** Projected door-zone distribution — resolved (auto-write-eligible) things only,
   *  grouped by their target zone. Unresolved things carry no zone yet. */
  byZone: SweepZoneCount[];
  triage: SweepTriageItem[];
  generatedAt: string;
}

/** One row of the Doc 19 §5 venue dictionary (`venue_neighborhoods`), shaped
 *  for the cockpit's dictionary table. */
export interface DictionaryEntry {
  name: string;
  neighborhood: string;
  zoneKey: DoorZoneKey | null;
  zoneLabel: string;
  aliases: string[];
  createdBy: string;
}
