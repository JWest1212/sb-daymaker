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

/** A placed stop on the spine. Insertion order is meaningful. */
export interface Stop {
  id: string;          // local uuid, stable key
  block: Block;
  thingId: string;     // FK into published `things`
  fromSaved: boolean;  // drives the ♥ Saved chip
  fromDraft: boolean;  // seeded by buildDraft → shows "Suggested" chip; false = user-added
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
  zone: Zone | null;   // null = "Anywhere"
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
  }>;
}
