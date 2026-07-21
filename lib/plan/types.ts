// Plan surface (v9.1 simplified), build-it-yourself single-day spine.
// No auto-generation, no day-shapes, no slotting engine.
// Itineraries live in localStorage (no accounts); no AI at tap time.

import type { OccasionKey } from "@/lib/occasions";
import type { Zone } from "@/lib/zones";

// UI blocks, three time-of-day periods shown to the user.
// DB `tod` enum has 4 values; Night maps to evening + late via BLOCK_TO_TOD.
export type Block = "morning" | "afternoon" | "night";

// DB tod enum, unchanged. Reach from UI via BLOCK_TO_TOD.
export type Tod = "morning" | "afternoon" | "evening" | "late";

// Period is a type alias for Block (kept for existing imports).
export type Period = Block;

// Maps each UI block to the DB tod values it covers.
export const BLOCK_TO_TOD: Record<Block, Tod[]> = {
  morning:   ["morning"],
  afternoon: ["afternoon"],
  night:     ["evening", "late"],
};

// The vibe subset the setup screen's Fine-tune exposes, 8 of the 10 occasion
// tags. `solo` and `family_day` are deliberately excluded because
// the Who selector right above already collects that signal.
export type VibeKey = Extract<
  OccasionKey,
  | "outdoors_active"
  | "wine_food"
  | "arts_culture"
  | "date_night"
  | "catch_a_show"
  | "nightlife"
  | "hosting_visitors"
  | "free_sb"
>;

export type Who = "solo" | "couple" | "family" | "friends";

// ---------------------------------------------------------------------------
// Elevation v1 · Gate 4 (The Concierge Day). Additive planner inputs that turn
// buildDraft from a picker into a constraint solver. All optional so existing
// callers (SharedPlanView, tests) keep constructing a 5-field PlanAnswers; the
// engine applies safe defaults when a field is absent.
// ---------------------------------------------------------------------------

/** Kid age band (Family only). Drives negative-rules (no 21+, no late night for
 *  toddlers) and pace. */
export type KidBand = "toddler" | "young" | "tweens";

/** How the party gets around. Caps cross-zone hops; only car unlocks distant
 *  zones (Goleta / Carpinteria / backcountry). */
export type Transport = "walk" | "car" | "bike";

/** Budget band. `mix` = mid with one splurge allowance. null = no preference. */
export type Budget = "cheap" | "mid" | "treat";

/** The three plannable meals. */
export type Meal = "breakfast" | "lunch" | "dinner";

/** Day pace. Controls stops-per-period. */
export type Pace = "packed" | "slow";

/** A placed stop on the spine. Insertion order is meaningful. */
export interface Stop {
  id: string;          // local uuid, stable key
  block: Block;
  thingId: string;     // FK into published `things`
  fromSaved: boolean;  // drives the ♥ Saved chip
  fromDraft: boolean;  // seeded by buildDraft → shows "Suggested" chip; false = user-added
  /** Gate 4 · G4.5, set when this stop was inserted as a meal (breakfast/lunch/
   *  dinner). Renders the sage meal chip; undefined for an activity stop. */
  meal?: Meal;
}

/** Gate 4 · G4.4, the deterministic transition annotation rendered between two
 *  consecutive stops (walk/drive estimate + parking truth). Pure-computed from
 *  lat/lng or zone adjacency; never a live routing call. */
export interface Transition {
  /** The stop id this transition sits *before* (the arrival stop). */
  beforeStopId: string;
  mode: "walk" | "drive";
  minutes: number;
  /** e.g. "4 min walk" or "8 min drive". */
  label: string;
  /** Zone-level parking truth, appended once at the first drive/inter-cluster
   *  hop (null when there is nothing worth saying). */
  parkingNote: string | null;
}

/** Gate 4 · G4.6, an honest note surfaced when the solver could not satisfy a
 *  request (e.g. no in-budget dinner nearby), instead of shipping a broken plan. */
export interface PlanNote {
  kind: "meal_unfilled" | "empty_block" | "budget" | "cluster";
  text: string;
}

/** A saved single-day itinerary (localStorage). */
export interface Itinerary {
  id: string;
  title: string;          // auto "Your SB Day · {Mon D}", editable inline
  dateISO: string;
  blocks: Block[];        // the selected periods = the spine sections
  stops: Stop[];          // insertion order is meaningful; no auto-sort
  createdAt: string;
  updatedAt: string;
}

/** The setup answers that drive the spine sections and picker ranking. */
export interface PlanAnswers {
  dateISO: string;
  periods: Block[];    // selected Time-of-Day → spine sections
  who: Who;
  vibes: VibeKey[];
  zone: Zone | null;   // null = "Anywhere"; also the plan's anchor/cluster origin
  // ---- Gate 4 (all optional; the engine defaults when absent) --------------
  kidBand?: KidBand | null;  // Family only
  transport?: Transport;     // default "car" (least restrictive on reachability)
  budget?: Budget | null;    // null = no budget preference
  meals?: Meal[];            // which meals to seat; default inferred from periods
  pace?: Pace;               // default "slow"; toddler forces "slow"
}

/** Gate 4 · G4.1, resolve the raw answers to a fully-defaulted input set that the
 *  pure engine and the shareable `params` snapshot both read. Keeps defaulting in
 *  one place so buildConciergeDay, hardFilter, meals and validate all agree. */
export interface ResolvedParams {
  dateISO: string;
  periods: Block[];
  who: Who;
  kidBand: KidBand | null;
  vibes: VibeKey[];
  zone: Zone | null;
  transport: Transport;
  budget: Budget | null;
  meals: Meal[];
  pace: Pace;
}

/**
 * shared_states.payload when kind='shared_plan'. A denormalized snapshot
 * so the opener needs no DB join and no local data of their own.
 * Rule 3: startsAt is present only when the source thing.starts_at is set, * never a fabricated daypart range.
 */
export interface SharedPlanPayload {
  title: string;
  dateISO: string;
  stops: Array<{
    block: Block;
    blockLabel: string;        // section label, e.g. "Afternoon"
    startsAt?: string | null;  // ISO datetime, only if thing.starts_at is set
    title: string;
    area: string;
    blurb: string;
    category: string;
    thingId: string;
    photo_url?: string | null;
    /** Gate 4 · G4.5, the meal chip label ("lunch"/"dinner"/"breakfast"). */
    meal?: Meal | null;
    /** Gate 4 · G4.4, the transition line to render *above* this stop (walk/drive
     *  + parking). Absent on the first stop. Denormalized so the opener needs no
     *  engine. */
    transition?: { label: string; parkingNote?: string | null } | null;
  }>;
  /** Gate 4 · G4.1, the resolved params that produced this plan, for the chip row
   *  on the shared view. Optional so old shared rows still render. */
  params?: {
    when: string;        // human label, e.g. "Sat Jun 28"
    who: string;         // e.g. "Family · toddler"
    transport?: string;  // e.g. "On foot"
    budget?: string;     // e.g. "$$ · one splurge"
    meals?: string;      // e.g. "Lunch + dinner"
  } | null;
}
