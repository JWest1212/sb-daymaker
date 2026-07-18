// Home Rework spec §9.2, deterministic header search. Pure matching logic, no AI,
// no network: given the already-loaded published `things` and a venue-id→name map,
// return grouped, capped, ordered hits. Shared by app/api/search/route.ts (server)
// so the matching rules live in exactly one place.
//
// Elevation v1 · Gate 3 · G3.2 (RECONCILE AND EXTEND, not a rebuild). Four scoped
// changes only, everything else (overlay, route, rate limit, no-AI, Tier-3
// exclusion, a11y, 3-group/5-cap shape) is untouched:
//   1. Events also match neighborhood/zone (title still ranked above a zone hit).
//   2. Light in-memory fuzzy (edit distance <= 1) as a rank BELOW exact/substring.
//   3. All three tag vocabularies read the doors' own sources (Occasion 8, Place 8,
//      Activity 10), so they can never drift from the live doors again.
//   4. Tag rows carry their door origin; event/venue links use the Gate 2 slug.

import type { Thing } from "./things";
import { DOOR_OCCASIONS, OCCASION_BY_KEY, type OccasionKey } from "./occasions";
import { DOOR_ZONES, DOOR_ZONE_BY_KEY, doorZoneForNeighborhood, type DoorZoneKey } from "./doorZones";
import { ACTIVITIES, type ActivityKey } from "./activities";
import { ZONE_LABEL } from "./zones";

export type SearchHitKind = "event" | "venue" | "tag";

/** The door a tag row belongs to, shown as a qualifier so overlapping labels
 *  (Nightlife is both an Occasion and an Activity) are distinguishable (G3.2 #4). */
export type TagDoor = "Place" | "Occasion" | "Activity";

export interface SearchHit {
  kind: SearchHitKind;
  id: string;
  label: string;
  /** Events + venues: navigable. Tags: absent, the caller applies a filter instead. */
  href?: string;
  /** Tags only: which door this tag belongs to (row qualifier). */
  door?: TagDoor;
  /** Tags only, which dimension + key to set (Home Rework spec §9.2 "Tags" group).
   *  Activity is wired end-to-end in Gate 3 (ExploreClient reads `?activity=`). */
  filter?:
    | { dimension: "vibe"; key: OccasionKey }
    | { dimension: "place"; key: DoorZoneKey }
    | { dimension: "activity"; key: ActivityKey };
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

// Rank tiers: lower is better. Exact-prefix (0) and substring (1) always sort
// ABOVE fuzzy (2), so a real match can never be displaced by a typo hit.
type Rank = 0 | 1 | 2;

/** True when `a` and `b` are within one edit (insertion/deletion/substitution).
 *  O(n), early-exits on length gap, no matrix, so it's cheap over ~265 rows and
 *  keeps the matcher pure and in-memory (no trigram, no DB, no network). */
function withinEdit1(a: string, b: string): boolean {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i++;
  if (la === lb) return a.slice(i + 1) === b.slice(i + 1); // substitution
  if (la > lb) return a.slice(i + 1) === b.slice(i); // deletion from a
  return a.slice(i) === b.slice(i + 1); // insertion into a
}

/** 0 = exact prefix, 1 = substring, 2 = fuzzy (token within edit distance 1),
 *  null = no match. Case-insensitive. Fuzzy only fires for queries >= 4 chars and
 *  only against label tokens of a comparable length, so it can't match noise. */
function matchRank(label: string, q: string): Rank | null {
  const l = label.toLowerCase();
  if (l.startsWith(q)) return 0;
  if (l.includes(q)) return 1;
  if (q.length >= 4 && l.split(/[\s·,&/]+/).some((tok) => tok.length >= 4 && withinEdit1(tok, q))) {
    return 2;
  }
  return null;
}

/** The best (lowest) rank across a thing's zone-ish labels, or null. Uses the
 *  same door-zone + Near-Me labels the rest of the UI shows, so "funk zone"
 *  matches things in the Funk Zone even when the title lacks the words (G3.2 #1). */
function zoneRank(t: Thing, q: string): Rank | null {
  const labels: string[] = [];
  const dz = doorZoneForNeighborhood(t.neighborhood);
  if (dz) labels.push(DOOR_ZONE_BY_KEY[dz].label);
  if (t.nearby_zone) labels.push(ZONE_LABEL[t.nearby_zone]);
  let best: Rank | null = null;
  for (const s of labels) {
    const r = matchRank(s, q);
    if (r !== null && (best === null || r < best)) best = r;
  }
  return best;
}

export function normalizeQuery(raw: string): string {
  return raw.trim().toLowerCase();
}

function splitCap<T>(items: T[]): { hits: T[]; overflow: number } {
  return { hits: items.slice(0, CAP), overflow: Math.max(0, items.length - CAP) };
}

/** Events: published thing titles + neighborhood/zone. Ordering: rank (prefix <
 *  substring < fuzzy), then title-field before zone-field at the same rank, then
 *  soonest starts_at (undated last). Field 0 = title, 1 = zone. */
function searchEvents(things: Thing[], q: string): { hits: SearchHit[]; overflow: number } {
  const ranked = things
    .map((t) => {
      const tr = matchRank(t.title, q);
      const zr = zoneRank(t, q);
      // Best rank wins; a tie prefers the title field (0) over the zone field (1).
      const cands: { r: Rank; f: 0 | 1 }[] = [];
      if (tr !== null) cands.push({ r: tr, f: 0 });
      if (zr !== null) cands.push({ r: zr, f: 1 });
      cands.sort((a, b) => a.r - b.r || a.f - b.f);
      return { t, rank: cands[0]?.r ?? null, field: cands[0]?.f ?? 0 };
    })
    .filter((r): r is { t: Thing; rank: Rank; field: 0 | 1 } => r.rank !== null)
    .sort((a, b) => {
      if (a.rank !== b.rank) return a.rank - b.rank;
      if (a.field !== b.field) return a.field - b.field; // title outranks zone at the same tier
      if (!a.t.starts_at && !b.t.starts_at) return 0;
      if (!a.t.starts_at) return 1;
      if (!b.t.starts_at) return -1;
      return a.t.starts_at.localeCompare(b.t.starts_at);
    })
    .map((r) => ({ kind: "event" as const, id: r.t.id, label: r.t.title, href: `/thing/${r.t.slug ?? r.t.id}` }));
  return splitCap(ranked);
}

/** Venues: distinct venue names among published things (Home Rework spec §18 #1).
 *  Routes to the venue's own standalone place card if it has one, else its soonest
 *  upcoming dated event. Links use the Gate 2 slug (G3.2 #4). */
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
    .filter((r): r is { id: string; name: string; rank: Rank; group: Thing[] } => r.rank !== null && !!r.group?.length)
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.name.localeCompare(b.name)))
    .map((r) => {
      const place = r.group.find((t) => t.type === "place");
      const soonestEvent = r.group
        .filter((t) => t.starts_at)
        .sort((a, b) => a.starts_at!.localeCompare(b.starts_at!))[0];
      const target = place ?? soonestEvent ?? r.group[0];
      return { kind: "venue" as const, id: r.id, label: r.name, href: `/thing/${target.slug ?? target.id}` };
    });
  return splitCap(ranked);
}

// The three tag vocabularies, read from the SAME sources the doors render from
// (lib/tiles.ts uses these exact arrays), so search can never drift from the live
// doors again. Occasion = the 8 live labels (DOOR_OCCASIONS + Dog Friendly);
// Place = 8 door zones; Activity = 10.
const TAG_VOCAB: { door: TagDoor; id: string; label: string; filter: NonNullable<SearchHit["filter"]> }[] = [
  ...[...DOOR_OCCASIONS, OCCASION_BY_KEY.dog_friendly].map((o) => ({
    door: "Occasion" as const,
    id: `vibe-${o.key}`,
    label: o.label,
    filter: { dimension: "vibe" as const, key: o.key },
  })),
  ...DOOR_ZONES.map((z) => ({
    door: "Place" as const,
    id: `place-${z.key}`,
    label: z.label,
    filter: { dimension: "place" as const, key: z.key },
  })),
  ...ACTIVITIES.map((a) => ({
    door: "Activity" as const,
    id: `activity-${a.key}`,
    label: a.label,
    filter: { dimension: "activity" as const, key: a.key },
  })),
];

/** Tags: the controlled door vocabularies (Occasion + Place + Activity). Tapping
 *  a hit sets that dimension's filter (the caller owns the state). Overlapping
 *  labels (Nightlife) yield two rows, each carrying its door origin. */
function searchTags(q: string): { hits: SearchHit[]; overflow: number } {
  const ranked = TAG_VOCAB.map((v) => ({ v, rank: matchRank(v.label, q) }))
    .filter((r): r is { v: (typeof TAG_VOCAB)[number]; rank: Rank } => r.rank !== null)
    .sort((a, b) => (a.rank !== b.rank ? a.rank - b.rank : a.v.label.localeCompare(b.v.label)))
    .map((r) => ({ kind: "tag" as const, id: r.v.id, label: r.v.label, door: r.v.door, filter: r.v.filter }));
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
