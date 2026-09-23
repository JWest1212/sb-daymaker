// lib/exploreParams.ts
//
// R1 Wave 6 (W6.1). The Explore view's state, as URL search params.
//
// Horizon, area, occasion and activity were client-only React state. That meant
// a shared link always opened on Today with no filters, whatever the sender was
// looking at, and the back button had nothing to restore because no history
// entry was ever written (EXP-019, DET-015, EXP-016).
//
// Pure parsers, so the SERVER can read the same params the client writes and the
// first paint already matches. Every parser is total: an unknown or malformed
// value falls back to the default rather than throwing, because a URL is
// untrusted input that people edit, truncate and mangle in chat apps.

import { HORIZONS, type Horizon } from "./explore";
import { AREA_BY_KEY, type AreaKey } from "./areas";
import { OCCASION_BY_KEY, type OccasionKey } from "./occasions";
import { ACTIVITY_BY_KEY, type ActivityKey } from "./activities";

/** Query-param names. One place, so the server, the client and any link that
 *  wants to deep-link into a view all spell them the same way. */
export const PARAM = {
  when: "when",
  area: "area",
  occasion: "occasion",
  activity: "activity",
} as const;

export function parseHorizon(value: string | undefined | null): Horizon {
  return HORIZONS.includes(value as Horizon) ? (value as Horizon) : "today";
}

// `Object.hasOwn`, never the `in` operator: `in` walks the prototype chain, so
// "constructor", "__proto__" and "toString" all pass it and would then resolve
// to something that is not an area at all. A query param is attacker-controlled.
const has = (obj: object, key: string) => Object.hasOwn(obj, key);

export function parseArea(value: string | undefined | null): AreaKey | null {
  return value && has(AREA_BY_KEY, value) ? (value as AreaKey) : null;
}

export function parseOccasion(value: string | undefined | null): OccasionKey | null {
  return value && has(OCCASION_BY_KEY, value) ? (value as OccasionKey) : null;
}

export function parseActivity(value: string | undefined | null): ActivityKey | null {
  return value && has(ACTIVITY_BY_KEY, value) ? (value as ActivityKey) : null;
}

export interface ExploreState {
  horizon: Horizon;
  area: AreaKey | null;
  occasion: OccasionKey | null;
  activity: ActivityKey | null;
}

/**
 * The query string for a view. Defaults are omitted, so the plain homepage stays
 * "/" rather than "/?when=today", and a shared link carries only what was chosen.
 */
export function exploreQuery(state: ExploreState): string {
  const sp = new URLSearchParams();
  if (state.horizon !== "today") sp.set(PARAM.when, state.horizon);
  if (state.area) sp.set(PARAM.area, state.area);
  if (state.occasion) sp.set(PARAM.occasion, state.occasion);
  if (state.activity) sp.set(PARAM.activity, state.activity);
  const q = sp.toString();
  return q ? `?${q}` : "";
}

/** Read a whole state out of a URLSearchParams-like object. */
export function parseExploreState(get: (k: string) => string | null | undefined): ExploreState {
  return {
    horizon: parseHorizon(get(PARAM.when)),
    area: parseArea(get(PARAM.area)),
    occasion: parseOccasion(get(PARAM.occasion)),
    activity: parseActivity(get(PARAM.activity)),
  };
}
