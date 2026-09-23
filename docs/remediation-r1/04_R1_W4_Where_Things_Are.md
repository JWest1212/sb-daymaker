# R1 Wave 4: Where Things Are

Purpose: one area vocabulary that Explore, Plan, Saved, detail pages, and the digest all use; a Place door that filters; a backfill so most listings have an area. This is the largest single trust fix after saves. Requires Wave 3.

Findings closed: EXP-002, EXP-003, EXP-038, EXP-020 (by decision D11), PLN-003, PLN-006, SAV-006, SAV-007, DET-002, DET-009, XC-005, CON-001 (museum area), TP-A2-01 to TP-A2-11.

Decisions in force: D5, D11.

## W4.1 One area module (lib/areas.ts, replacing the public role of lib/zones.ts and lib/doorZones.ts)

- Export the 8 public areas with `key`, `label` (one display string each, used everywhere), `short` (for chips and card meta), and `neighborhoods` (the `neighborhood` enum values that roll up to it) and `nearbyZone` (the `nearby_zone` value that maps to it, where one exists).
- Labels, final: Downtown and State Street; Funk Zone; Waterfront and Harbor; The Mesa; Mission and Riviera; Upper State; Goleta and Isla Vista; Montecito, Summerland, and Carpinteria. Short forms: Downtown; Funk Zone; Waterfront; The Mesa; Mission and Riviera; Upper State; Goleta; Montecito.
- `areaForThing(t)` resolves from `neighborhood` first, then `nearby_zone`, then null. Never returns "other"; unknown is null and displays as nothing, not "OTHER" or "Santa Barbara".
- `lib/zones.ts` and `lib/doorZones.ts` become thin adapters over `lib/areas.ts` or are deleted once no import remains. `lib/tiles.ts` counts against `areaForThing`.
- Unit tests: every enum value maps to exactly one area or to null; every area label is used verbatim by the Explore door, the Plan area step, the Saved Near Me sheet, the detail Neighborhood field, the nearby heading, and the digest location line.

## W4.2 The Place door filters (components/explore/ExploreClient.tsx:113, DiscoveryDoors.tsx)

- Replace `sortByDoorZone` with a real filter on `areaForThing`. Keep the accessible name "Filter by place" true. The chip is removable like the other two.
- Areas with zero results in the current horizon render disabled with their count, not hidden, so the vocabulary stays stable.
- Door tile counts compute over the corrected pool (Wave 1) and the current horizon.
- "Show the closest matches" (EXP-015) names the filter it relaxes: "Showing all areas" or "Showing all occasions".

## W4.3 Plan and Saved consume the module

- Plan's area step lists the 8 areas plus "Anywhere in SB" (one string, used in Plan and Saved). `hardFilter` compares via `areaForThing`.
- Saved Near Me lists the same 8 plus "Anywhere in SB" and sorts via `areaForThing`. The button shows the chosen short label and the count matched: "Funk Zone, 3 of 7".
- "Use my location" times out after 6 seconds with "Couldn't get your location. Pick an area instead." and falls back to the list (SAV-007).

## W4.4 Backfill (ingest/areas-backfill.ts, one-time, dry-run first)

- For every published or archived row with null `neighborhood` and null `nearby_zone`, resolve in this order: (1) a venue-name lookup table `ingest/data/venues.json` seeded from the known venues, each with its area; (2) nearest area centroid from `lat/lng` when present (eight centroids in `lib/areas.ts`, no boundary file); (3) the existing Google Places geocode path from `address`, within the monthly cap, then rule 2. Write `neighborhood`; derive `nearby_zone` from the module mapping.
- CP3: dry-run prints a table by source (resolved by venue, by coordinates, by geocode, unresolved) and 30 examples. Stop and wait for Jim's go, then write. Expect the 585 nulls to fall to under 100.
- Unresolved rows are listed for Jim's sweep console. Nothing is guessed.
- Going forward, `ingest/enrich.ts` and `land` require an area for publish of any row with an address; rows without one land as `needs_review` with a reason.

## W4.5 Specific corrections

- The Natural History Museum and everything at 2559 Puesta del Sol resolves to Mission and Riviera. Oak Park (300 W Alamar) resolves to Upper State or The Mesa per the boundary file; whichever it is, the detail field, nearby heading, and digest agree (DET-002).
- Detail pages show Neighborhood on its own line under the address using the module label (DET-009).

## W4.6 Canon note

- Near Me on Explore is not built (D11). Wave 8 records it. Remove any dormant Near Me chip code from Explore if present.

## Acceptance

1. On Month, choose Funk Zone: the count changes and every card is in the Funk Zone. Choose Montecito: same. Reopen the sheet: the chosen tile is marked.
2. The Place sheet shows counts on every tile; zero-count tiles are visibly disabled and not hidden.
3. Plan B (Wave 3 acceptance): with area coverage backfilled, all stops are in the Funk Zone or the widened note shows.
4. Saved Near Me with saves spread across three areas reorders visibly and the button shows "Funk Zone, N of M".
5. Deny or ignore the location prompt: the spinner stops within 6 seconds with the fallback message.
6. `select count(*) from things where status in ('published','archived') and neighborhood is null and nearby_zone is null` is under 100, and the dry-run table was shown before writing.
7. The word "OTHER" and the city-name fallback appear nowhere on a card, chip, or detail page.
8. The eight labels appear identically on Explore, Plan, Saved, one detail page, and /digest/sample.
9. Tests green.

Commit: `feat(r1-w4): single area module, place door filters, area backfill, near me and plan consume it`
