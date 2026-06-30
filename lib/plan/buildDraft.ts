// Pure, deterministic spine seeder. No AI. Called when the user taps "Build my day."
// Places one ranked pick per selected period as a fromDraft Stop.
// Also used for Regenerate (pass `alreadyPlaced` to exclude current stops).

import { rankCandidates } from "./rankCandidates";
import type { Block, PlanAnswers, Stop, VibeKey } from "./types";
import type { Thing } from "@/lib/things";

// Soft category boost applied only when the user selected no vibes.
// These keys are OccasionKeys used only for tag matching — not shown in setup UI.
const DEFAULT_PRIOR: Record<Block, string[]> = {
  morning:   ["outdoors_active", "food_drink_spot"],
  afternoon: ["arts_culture", "shopping_browse", "food_drink_spot"],
  night:     ["wine_food", "catch_a_show", "nightlife"],
};

function genId(): string {
  return Math.random().toString(36).slice(2, 9);
}

/**
 * Seeds the spine with one ranked pick per selected period.
 *
 * @param answers      The user's setup answers (date, periods, who, vibes, zone).
 * @param pool         Full published things pool.
 * @param savedStateFor  Returns the save-state for a thingId (or null).
 * @param alreadyPlaced  ThingIds to exclude (used by Regenerate to skip current stops).
 */
export function buildDraft(
  answers: PlanAnswers,
  pool: Thing[],
  savedStateFor: (id: string) => "want" | "been" | null,
  alreadyPlaced: Set<string> = new Set(),
): Stop[] {
  const placed = new Set<string>(alreadyPlaced);
  const draft: Stop[] = [];

  for (const block of answers.periods) {
    // When no vibes selected, inject DEFAULT_PRIOR as a soft boost (tag-matching only).
    const perBlockAnswers: PlanAnswers =
      answers.vibes.length === 0
        ? { ...answers, vibes: DEFAULT_PRIOR[block] as VibeKey[] }
        : answers;

    const ranked = rankCandidates(block, perBlockAnswers, pool, savedStateFor, placed);
    const pick = ranked[0];
    if (!pick) continue; // thin inventory — leave block empty, its add-slot shows

    placed.add(pick.thing.id);
    draft.push({
      id: genId(),
      block,
      thingId: pick.thing.id,
      fromSaved: pick.savedState !== null,
      fromDraft: true,
    });
  }

  return draft;
}
