// lib/edition/imageQuery.ts
//
// Pure query-building for the "find more options" widened search (no
// server-only import here — kept testable, unlike imageDiscovery.ts which
// does the actual network fetch and needs the server-only guard).
//
// Two angles, tried in order, not one combined string: a live check against
// Pexels found that appending "Santa Barbara" to every query anchors the
// results toward the same generic local stock photos regardless of what else
// is in the string (e.g. "theater stage performance downtown Santa Barbara"
// and "downtown Santa Barbara" returned near-identical result sets) — the
// location term dominates relevance ranking. Dropping it for a topic-only
// pass returns a genuinely disjoint set (verified: zero id overlap), so the
// category-only query does the real diversifying; the location query is the
// fallback for things with no category.

import { CATEGORY_QUERY } from "../../ingest/images";

export interface QueryableThing {
  neighborhood: string | null;
  happening_category: string | null;
}

/** Ordered search angles for widening a thing's photo options. Topic-only
 *  first (most diversifying), then neighborhood + Santa Barbara as a
 *  location-anchored fallback. Deduped and never empty (falls back to a bare
 *  "Santa Barbara" search if the thing has neither category nor neighborhood). */
export function discoveryQueries(thing: QueryableThing): string[] {
  const hood = thing.neighborhood ? thing.neighborhood.replace(/_/g, " ") : "";
  const cat = thing.happening_category
    ? CATEGORY_QUERY[thing.happening_category as keyof typeof CATEGORY_QUERY]
    : undefined;
  const queries = [cat, [hood, "Santa Barbara"].filter(Boolean).join(" ")].filter(Boolean) as string[];
  return [...new Set(queries)];
}
