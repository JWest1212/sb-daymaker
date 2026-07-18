// lib/edition/types.ts
//
// Shared types for the reader-edition drafter (edition_build_spec.md §2-3).
// Deliberately relative-import-only (no `@/` alias) so this module loads the
// same way from Next.js (cockpit, later phases) and from the ingest/ worker
// (tsx in the GitHub Action), mirrors lib/heroServer.ts / lib/occurrences.ts.
// PhotoSource is a plain type-only import (no server-only/env dependency), so
// it's safe under the same dual-context constraint.

import type { PhotoSource } from "../../packages/shared/types";

export type EditionType = "weekend" | "week_ahead";
export type EditionSlot = "hero" | "secondary" | "nonevent" | "anchor";

/** A published `things` row shaped for the drafter. Deliberately excludes
 *  `is_featured` / `sponsor_id`, sponsor-blindness is enforced by never
 *  fetching those columns, not just by convention (spec §0.2). */
export interface DraftThing {
  id: string;
  type: string; // 'place' | 'event' | 'firstlook' | 'happyhour'
  title: string;
  blurb: string | null;
  blurb_long: string | null;
  local_note: string | null;
  reason_to_go: string | null;
  happening_tier: number;
  happening_category: string;
  editorial_weight: number;
  neighborhood: string | null;
  starts_at: string | null;
  ends_at: string | null;
  hero_eligible: boolean;
  photo_url: string | null;
  photo_source: string | null;
  photo_attribution: string | null;
  photo_options: { url: string; source: PhotoSource; width?: number; height?: number; attribution?: string }[];
  created_at: string | null;
  last_confirmed: string | null;
  recurring: {
    day_of_week: number | null;
    start_time: string | null;
    end_time: string | null;
    frequency: string | null;
    label: string | null;
  }[];
}

export interface SlotPick {
  thing: DraftThing;
  isManual: false; // the drafter never marks its own auto-picks manual
}

export interface SlotSelection {
  picks: DraftThing[]; // in RENDER order (chronological for secondaries; single-item otherwise)
  rankedBench: DraftThing[]; // in RANK order (cascade order, rank 0 = best), for edition_candidates
}

export interface HeroSelection extends SlotSelection {
  source: "pin" | "auto" | "evergreen" | "none";
}

export interface AnchorSelection extends SlotSelection {
  fires: boolean; // whether the anchor actually appears in this issue
}

export interface EditionSelection {
  hero: HeroSelection;
  secondary: SlotSelection;
  nonevent: SlotSelection;
  anchor: AnchorSelection;
}

export interface EditionCopy {
  subject: string;
  preheader: string;
  greeting: string;
}

export interface DraftResult {
  ok: boolean;
  editionId: string;
  editionDate: string;
  editionType: EditionType;
  status: "draft" | "failed";
  skipReason?: string;
  heroSource?: HeroSelection["source"];
  counts?: { secondaries: number; nonevent: number; anchor: number };
}
