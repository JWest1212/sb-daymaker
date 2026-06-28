// Plan surface (v9.1) — the data model for a single-day planner.
// Itineraries live in localStorage (no accounts); days are assembled
// deterministically from already-published `things` + hand-authored day-shapes
// (no AI at tap time). See docs/plan-feature/SBDaymaker_Plan_Build.md §2–§4.

import type { OccasionKey } from "@/lib/occasions";
import type { Zone } from "@/lib/zones";

// The planner's own block vocabulary. NOTE this is distinct from the DB `tod`
// enum (morning·afternoon·evening·late): here "night" is the UI's word for
// tod='late', and "midday" is a planner-only lunch bridge (not a stored tod).
export type Block = "morning" | "midday" | "afternoon" | "evening" | "night";

// The vibe subset the setup screen's Fine-tune exposes — 8 of the 10 occasion
// tags (build doc §4). `solo` and `family_day` are deliberately excluded because
// the Who selector right above already collects that signal. Kept as OccasionKey
// so it flows straight into ranking.
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

// UI "parts of the day" → the DB `tod` values they map to ("Night" → 'late').
export type Period = "morning" | "afternoon" | "evening" | "late";

export type Who = "solo" | "couple" | "family" | "friends";

/** One block of a day-shape skeleton: what kind of stop fills it. */
export interface DaySlot {
  tags: OccasionKey[]; // ordered preference — fall down the list when filling
  areaHint?: Zone;
}

/** A hand-authored day skeleton (content config, refreshable seasonally). */
export interface DayShape {
  id: string;
  name: string;
  caption: string;
  anchorZones: Zone[];
  slots: Partial<Record<Block, DaySlot>>;
}

/** A placed stop on the spine. */
export interface Stop {
  block: Block;
  thingId: string; // FK into published `things`
  pinned: boolean; // true if user-pinned from saved (locked)
  fromSaved: boolean; // drives the ♥ Saved chip
}

/** A saved single-day itinerary (localStorage). */
export interface Itinerary {
  id: string; // local uuid
  title: string; // auto from day-shape, editable
  dateISO: string;
  blocks: Block[]; // active blocks
  dayShapeId: string;
  stops: Stop[];
  createdAt: string;
  updatedAt: string;
}

/** The five setup answers that drive `buildDay`. */
export interface PlanAnswers {
  dateISO: string;
  periods: Period[]; // 'late' = UI "Night"
  who: Who;
  vibes: VibeKey[];
  zone: Zone | null; // null = "Anywhere"
}

/**
 * shared_states.payload when kind='shared_plan' (Phase 8). A denormalized
 * snapshot so the opener needs no DB join and no local data of their own.
 */
export interface SharedPlanPayload {
  title: string;
  dateISO: string;
  stops: Array<{
    block: Block;
    timeLabel: string; // "Afternoon · 2–5 PM"
    title: string;
    area: string;
    blurb: string;
    category: string;
    thingId: string; // lets the opener deep-link to the live detail if present
  }>;
}
