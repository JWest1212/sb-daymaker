// lib/visualAssignment.ts
//
// Card Imagery Build Spec Phase 3 §6.2, deterministic assignment of the motif
// tier. Runs whenever a candidate has no real photo: every Tier-1 dated event
// (which always skips photo search, `eventDefaultsToNoPhoto` in ingest/images.ts)
// and any Tier-2/3 miss from the resolver's free/paid waterfall. Pure + unit-tested
// so the ingest resolver and every backfill share one definition instead of
// drifting, same pattern as `pickFromPool`/`dedupeFeedVenuePhotos` above.
//
// Lives in lib/ (not ingest/) so the resolver AND the app side (which only needs
// the `MotifKey` union + `MOTIF_KEYS` list to keep its render registry in sync) can
// both import from one place, ingest/ already depends one-way on lib/, never the
// reverse.

import type { HappeningCategory } from '../packages/shared/types';
import { hashString } from './venuePool';

export type VisualKind = 'motif' | 'bigtype';

/** The 9 ported SVG motifs (`components/visuals/motifs.tsx`), the single source of
 *  truth for which `visual_key` values the client registry actually renders.
 *  Counted directly off `docs/card-imagery/SBDaymaker_Explore_Feed_Mockup_v1.html`
 *  (9 distinct art blocks, not the spec prose's "8", see the 2026-07-10 kickoff
 *  ledger entry). Adding a 10th motif from the art track means adding it here AND
 *  to the client registry, nowhere else (§6.2: "the registry must accept drop-in
 *  additions without code changes elsewhere"). */
export const MOTIF_KEYS = [
  'stage', 'sunset', 'market', 'trail', 'wharf', 'mission', 'books', 'taproom', 'beach',
] as const;
export type MotifKey = (typeof MOTIF_KEYS)[number];

/** Category -> candidate motif pool. Multiple categories legitimately share a motif
 *  (16 `HappeningCategory` values, 9 motifs), §6.2 expects this ("deterministic
 *  mapping category/venue-family -> motif"). `wharf` and `mission` are deliberately
 *  EXCLUDED here: both are a single, architecturally-specific landmark in the
 *  mockup's own art (Stearns Wharf's pier, the Mission's twin bell towers), reused
 *  generically they'd misrepresent an unrelated venue. They're reserved for the
 *  venue-family override below, so they only ever render on the real landmark.
 *  `beach` (generic waves + sand, not tied to one specific beach) earns a spot as a
 *  second `scenic_chill` variant instead. */
const CATEGORY_MOTIFS: Partial<Record<HappeningCategory, MotifKey[]>> = {
  live_music: ['stage'],
  arts_theater: ['stage'],
  recurring_arts: ['stage'],
  festival_fair: ['market'],
  community_gathering: ['market'],
  recurring_market: ['market'],
  food_drink_event: ['taproom'],
  food_drink_spot: ['taproom'],
  weekly_special: ['taproom'],
  recurring_nightlife: ['taproom'],
  sports_outdoors_event: ['trail'],
  outdoor_activity: ['trail'],
  recurring_outdoors: ['trail'],
  scenic_chill: ['sunset', 'beach'],
  shopping_browse: ['books'],
  culture_spot: ['books'],
};

/** Venue-family override (§6.2's "…/venue-family -> motif"): a candidate matched to
 *  one of these landmarks (reusing the Phase 1 marquee registry's own matcher, *  `ingest/marqueeVenues.ts`'s `matchMarqueeVenue`, so this never drifts from the
 *  photo-pin priority step's idea of "is this the Mission/the Wharf") gets its
 *  landmark motif regardless of category, checked before the generic pool above. */
export const VENUE_MOTIFS: Partial<Record<string, MotifKey>> = {
  'old-mission': 'mission',
  'stearns-wharf': 'wharf',
};

/** Roughly 1-in-8 things get the big-type treatment even when a motif pool exists, *  matching the mockup's own ~1-in-10 ratio, and its own demonstrated behavior: the
 *  Lobero card ("Jazz at the Lobero", arts_theater, a category WITH a valid "stage"
 *  motif) rendered as big-type ("1873") anyway, the mockup's own legend calling it
 *  "the D8 type fallback in situ." That's a deliberate occasional substitution for
 *  visual variety, not a sign the category lacks a motif, replicated here as a
 *  seeded, deterministic (not random) one-in-N substitution so it's still idempotent
 *  across re-runs/backfills. A category truly missing from the pool above (none
 *  today, every `HappeningCategory` has an entry, but §6.2 requires new
 *  categories/motifs to drop in without code changes elsewhere) falls straight to
 *  big-type regardless of this ratio. */
const BIGTYPE_EVERY = 8;

export interface VisualAssignment {
  visual_kind: VisualKind;
  visual_key: MotifKey | null;
  visual_seed: number;
}

/** Pure, deterministic, the same thing always gets the same assignment (idempotent
 *  re-runs/backfills), matching `pickFromPool`'s own determinism guarantee. Assigned
 *  ONCE at ingest/resolve time and persisted (`things.visual_kind/visual_key/
 *  visual_seed`), unlike venue-pool rotation this never needs to reshuffle day to
 *  day, so the seed is keyed on the thing id alone. `matchedVenueKey` is the id of a
 *  `MARQUEE_VENUES` entry the caller already matched (or `undefined`/`null` if none)
 *, this module never imports `ingest/marqueeVenues.ts` itself (lib/ can't depend
 *  on ingest/), the caller passes the match in. */
export function assignVisual(
  c: { id: string; happening_category?: HappeningCategory | null },
  matchedVenueKey?: string | null,
): VisualAssignment {
  // `hashString` returns a full unsigned 32-bit value (up to ~4.29B); `things.
  // visual_seed` is a Postgres `integer` (signed int4, max ~2.147B), masking to
  // 31 bits keeps every possible output in range without weakening determinism
  // (still one of 2^31 values, still a pure function of the id).
  const seed = hashString(c.id) & 0x7fffffff;
  const venueMotif = matchedVenueKey ? VENUE_MOTIFS[matchedVenueKey] : undefined;
  if (venueMotif) return { visual_kind: 'motif', visual_key: venueMotif, visual_seed: seed };

  const pool = c.happening_category ? CATEGORY_MOTIFS[c.happening_category] : undefined;
  if (!pool || !pool.length) return { visual_kind: 'bigtype', visual_key: null, visual_seed: seed };
  if (seed % BIGTYPE_EVERY === 0) return { visual_kind: 'bigtype', visual_key: null, visual_seed: seed };
  return { visual_kind: 'motif', visual_key: pool[seed % pool.length], visual_seed: seed };
}
