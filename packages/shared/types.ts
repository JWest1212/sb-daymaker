// packages/shared/types.ts
//
// The contract that flows gate -> DB -> cockpit. Imported by the ingestion
// worker AND the Next.js app. This is why TypeScript is end-to-end: the gate's
// output is the cockpit's input, checked at compile time. (Doc 11 §3.)

export type ThingType = 'place' | 'event' | 'firstlook' | 'happyhour';
export type Status = 'draft' | 'needs_review' | 'published' | 'archived';
export type Tier = 1 | 2 | 3;
export type PriceBand = 'free' | '$' | '$$' | '$$$';
export type Tod = 'morning' | 'afternoon' | 'evening' | 'late';

export type Neighborhood =
  | 'funk_zone' | 'downtown' | 'waterfront' | 'montecito' | 'mesa'
  | 'mission_canyon' | 'riviera' | 'upper_state' | 'goleta' | 'carpinteria' | 'other';

export type HappeningCategory =
  // Tier 1
  | 'live_music' | 'festival_fair' | 'arts_theater' | 'community_gathering'
  | 'food_drink_event' | 'sports_outdoors_event'
  // Tier 2
  | 'weekly_special' | 'recurring_nightlife' | 'recurring_market'
  | 'recurring_arts' | 'recurring_outdoors'
  // Tier 3
  | 'outdoor_activity' | 'food_drink_spot' | 'culture_spot'
  | 'shopping_browse' | 'scenic_chill';

export type OccasionTag =
  | 'date_night' | 'family_day' | 'nightlife' | 'catch_a_show' | 'arts_culture'
  | 'outdoors_active' | 'wine_food' | 'free_sb' | 'hosting_visitors' | 'solo';

export type PhotoSource = 'pexels' | 'wikimedia' | 'google' | 'owned' | 'placeholder';

/**
 * How an adapter proves a start time. The gate consults this to decide whether a
 * start is "deterministic". 'structured' = a machine field (e.g. Ticketmaster
 * dateTime). 'server_detail' = an explicit clock time on a server-rendered detail
 * page (the SOhO pattern). 'none' = no start exists (evergreen Tier-3 / recurring
 * Tier-2 only). Prose-derived guesses are NEVER a valid strategy — there is no
 * enum value for them.
 */
export type StartStrategy = 'structured' | 'server_detail' | 'none';

export type RecurFrequency = 'weekly' | 'biweekly' | 'monthly';

/** A Tier-2 recurring rhythm occurrence. start_time is null when the day is known
 *  but the time isn't — we never guess a time (it lands blank + flagged). */
export interface RecurringSpec {
  day_of_week: number;          // 0 = Sunday
  start_time: string | null;    // 'HH:MM' or null (time unknown)
  end_time: string | null;
  frequency: RecurFrequency;
  label?: string;
  time_unknown?: boolean;
}

/** Raw, pre-gate item emitted by an adapter. Deliberately permissive. */
export interface RawCandidate {
  source: string;                 // adapter key (or, for seed fixtures, the source URL / sentinel)
  title?: string;
  venueName?: string;
  address?: string;
  lat?: number; lng?: number;
  tier: Tier;
  category: HappeningCategory;
  type: ThingType;
  startISO?: string;              // ISO 8601 with offset, IF the adapter has one
  endISO?: string;
  startStrategy: StartStrategy;   // how (and whether) the start was obtained
  priceLow?: number | null;       // lowest ticket price, if known
  explicitlyFree?: boolean;       // only true if the source literally says free
  sourceUrl?: string;
  buyUrl?: string;
  placeId?: string;
  neighborhood?: Neighborhood;
  reasonToGo?: string;            // required for Tier-3 at gate time
  localNote?: string;
  is21Plus?: boolean;             // feeds the family_day negative rule (unset unless a source knows)
  recurring?: RecurringSpec[];    // Tier-2 rhythms — written to recurring_schedules at land time
  /** When true: a rhythm proposal bound for recurringRegistry.ts (§3). The gate
   *  enforces recurring[0].start_time presence; dedupe checks against the live file;
   *  the cockpit emits a paste-ready snippet on approval (never auto-publishes). */
  registryCandidate?: true;
  /** Adapter-seeded occasion tags, carried through to proposed_tags at enrich time. */
  occasionTags?: OccasionTag[];
  raw?: unknown;                  // original payload, for drop logging / rescue
}

/** Post-gate row, ready to land. Note start_at is required for T1 by construction. */
export interface Candidate {
  id: string;                     // uuid5, deterministic
  type: ThingType;
  status: 'needs_review';
  title: string;
  tier: Tier;
  happening_category: HappeningCategory;
  neighborhood?: Neighborhood;
  address: string;                // navigable (or resolved-from-venue) — required
  lat?: number; lng?: number;
  price_band: PriceBand | null;
  time_of_day_fit: Tod[];
  starts_at: string | null;       // non-null for dated T1; null for recurring T2 / evergreen T3
  ends_at: string | null;
  buy_url?: string;
  source_url: string;             // required
  place_id?: string;
  reason_to_go?: string;          // required for T3
  local_note?: string;
  is_21_plus?: boolean;           // carried for the family_day negative rule (enrich.ts)
  recurring?: RecurringSpec[];    // Tier-2 schedule rows to write at land time
  last_confirmed: string;         // run date
  start_strategy: StartStrategy;  // carried through for the cockpit trust chip
  // image fields (set by resolveImages, pre-landing — see Doc 11 §7b):
  photo_url?: string;             // current pick = photo_options[0] at land time
  photo_source?: PhotoSource;     // provenance shown as the card's source-pill
  photo_options?: { url: string; source: PhotoSource; width?: number; height?: number; attribution?: string }[];
  // AI-written fields, filled later by enrich.ts (never here):
  blurb?: string;
  blurb_long?: string;
  proposed_tags?: { tag: OccasionTag; confidence: number }[];
}

export type DropReason =
  | 'no_title' | 'no_address' | 'no_source' | 'no_start' | 'duplicate'
  /** Registry candidate missing a deterministic day+time (§3.2). */
  | 'registry_incomplete_time'
  /** Registry candidate whose rhythm already lives in recurringRegistry.ts (§3.3). */
  | 'registry_exists';
export interface GateResult {
  ok: boolean;
  candidate?: Candidate;
  reason?: DropReason;
  detail?: string;                // e.g. 'start said "8-ish"'
}
