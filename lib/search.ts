// Home Rework spec §9.2, deterministic header search. Pure matching logic, no AI,
// no network: given the already-loaded published `things` and a venue-id→name map,
// return grouped, capped, ordered hits. Shared by app/api/search/route.ts (server)
// so the matching rules live in exactly one place.

import type { Thing } from "./things";
import { OCCASIONS, type OccasionKey } from "./occasions";
import { DOOR_ZONES, type DoorZoneKey } from "./doorZones";

export type SearchHitKind = "event" | "venue" | "tag";

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  label: string;
  /** Events + venues: navigable. Tags: absent, the caller applies a filter instead. */
  href?: string;
  /** Tags only, which dimension + key to set (Home Rework spec §9.2 "Tags" group).
   *  Activity is added once Phase 4 gives ExploreClient an `activity` filter to set. */
  filter?: { dimension: "vibe"; key: OccasionKey } | { dimension: "place"; key: DoorZoneKey };
}

export interface SearchResults {
  events: SearchHit[];
  eventsOverflow: number;
  venues: SearchHit[];
  venuesOverflow: number;
  tags: SearchHit[];
  tagsOverflow: number;
}

const CAP = 5;

/** 0 = exact prefix match, 1 = substring match, null = no match. Case-insensitive. */
function matchRank(label: string, q: string): 0 | 1 | null {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (l.includes(q)) return 1;
  return null;
}

export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function splitCap<T>(items: T[]): { hits: T[]; overflow: number } {
  return { hits: items.slice(0, CAP), overflow: Math.max(0, items.length - CAP) };
}

/** Events: published thing titles. Ordering: exact prefix first, then substring,
 *  then soonest starts_at (undated things sort last within their rank). */
function searchEvents(things: Thing[], q: string): { hits: SearchHit[]; overflow: number } {
  const ranked = things
    .map((t) => ({ t, rank: matchRank(t.title, q) }))
    .filter((r): r is { t: Thing; rank: 0 | 1 } => r.rank !== null)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (!a.t.starts_at && !b.t.starts_at) return 0;
      if (!a.t.starts_at) return 1;
      if (!b.t.starts_at) return -1;
      return a.t.starts_at.localeCompare(b.t.starts_at);
    })
    .map((r) => ({ kind: "event" as const, id: r.t.id, label: r.t.title, href: `/thing/${r.t.id}` }));
  return splitCap(ranked);
}

/** Venues: distinct venue names among published things (Home Rework spec §18 #1, *  resolved in Phase 2: joins the curated `venues` table via `venue_id`, not the
 *  neighborhood cardPlace() derives). Routes to the venue's own standalone place
 *  card if it has one, else its soonest upcoming dated event. */
function searchVenues(
  things: Thing[],
  venueNames: Record<string, string>,
  q: string,
): { hits: SearchHit[]; overflow: number } {
  const byVenue = new Map<string, Thing[]>();
  for (const t of things) {
    if (!t.venue_id) continue;
    (byVenue.get(t.venue_id) ?? byVenue.set(t.venue_id, []).get(t.venue_id)!).push(t);
  }

  const ranked = Object.entries(venueNames)
    .map(([id, name]) => ({ id, name, rank: matchRank(name, q), group: byVenue.get(id) }))
    .filter((r): r is { id: string; name: string; rank: 0 | 1; group: Thing[] } => r.rank !== null && !!r.group?.length)
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.name.localeCompare(b.name)))
    .map((r) => {
      const place = r.group.find((t) => t.type === "place");
      const soonestEvent = r.group
        .filter((t) => t.starts_at)
        .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0];
      const target = place ?? soonestEvent ?? r.group[0];
      return { kind: "venue" as const, id: r.id, label: r.name, href: `/thing/${target.id}` };
    });
  return splitCap(ranked);
}

/** Tags: the controlled display vocabulary, Vibe (occasion) + Place (zone) labels.
 *  Tapping a hit sets that dimension's filter (the caller owns the actual state). */
function searchTags(q: string): { hits: SearchHit[]; overflow: number } {
  const ranked = [
    ...OCCASIONS.map((o) => ({ id: o.key, label: o.label, rank: matchRank(o.label, q), filter: { dimension: "vibe" as const, key: o.key } })),
    ...DOOR_ZONES.map((z) => ({ id: z.key, label: z.label, rank: matchRank(z.label, q), filter: { dimension: "place" as const, key: z.key } })),
  ]
    .filter((r): r is typeof r & { rank: 0 | 1 } => r.rank !== null)
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.label.localeCompare(b.label)))
    .map((r) => ({ kind: "tag" as const, id: r.id, label: r.label, filter: r.filter }));
  return splitCap(ranked);
}

export function searchThings({
  query,
  things,
  venueNames,
}: {
  query: string;
  things: Thing[];
  venueNames: Record<string, string>;
}): SearchResults {
  const q = normalizeQuery(query);
  if (!q) return { events: [], eventsOverflow: 0, venues: [], venuesOverflow: 0, tags: [], tagsOverflow: 0 };

  const events = searchEvents(things, q);
  const venues = searchVenues(things, venueNames, q);
  const tags = searchTags(q);
  return {
    events: events.hits,
    eventsOverflow: events.overflow,
    venues: venues.hits,
    venuesOverflow: venues.overflow,
    tags: tags.hits,
    tagsOverflow: tags.overflow,
  };
}
