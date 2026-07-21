// Pure, deterministic spine seeder. No AI. Kept as a thin wrapper so any caller
// that only needs the seeded Stop[] still works; the real logic now lives in
// buildConciergeDay (Gate 4), which upgrades this from a picker into a constraint
// solver (hard filter -> clustering -> meals -> validation). Extends, not replaces.

import { buildConciergeDay } from "./buildConciergeDay";
import type { PlanAnswers, Stop } from "./types";
import type { Thing } from "@/lib/things";

/**
 * Seeds the spine with the concierge engine and returns just the stops.
 * @param alreadyPlaced  ThingIds to exclude (used by Regenerate to skip current stops).
 */
export function buildDraft(
  answers: PlanAnswers,
  pool: Thing[],
  savedStateFor: (id: string) => "want" | "been" | null,
  alreadyPlaced: Set<string> = new Set(),
): Stop[] {
  return buildConciergeDay(answers, pool, savedStateFor, { alreadyPlaced }).stops;
}
