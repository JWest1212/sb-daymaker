// lib/edition/cockpitTypes.ts
//
// Client-safe shapes for the cockpit "Edition Draft" module — no server-only
// imports here (mirrors the lib/review.ts / lib/reviewServer.ts split) so
// client components can import these types directly.

import type { EditionSlot, EditionType } from "./types";
import type { PhotoOption } from "../review";

export interface CockpitThing {
  id: string;
  title: string;
  neighborhood: string | null;
  photo_url: string | null;
  photo_options: PhotoOption[];
  when: string;
  happening_tier: number;
}

export interface CockpitPick {
  id: string;
  slot: EditionSlot;
  position: number;
  thingId: string;
  thing: CockpitThing;
  override_title: string | null;
  override_blurb: string | null;
  override_when: string | null;
  override_neighborhood: string | null;
  override_local_note: string | null;
  override_image_url: string | null;
  cached_image_url: string | null;
  is_manual: boolean;
}

export interface CockpitCandidate {
  slot: EditionSlot;
  rank: number;
  selected: boolean;
  thing: CockpitThing;
}

export interface EditionSummary {
  id: string;
  edition_date: string;
  edition_type: EditionType;
  status: string;
  subject: string | null;
}

export interface EditionDraftDetail {
  id: string;
  edition_date: string;
  edition_type: EditionType;
  status: string;
  subject: string | null;
  preheader: string | null;
  greeting: string | null;
  skip_reason: string | null;
  approved_at: string | null;
  sent_at: string | null;
  sent_count: number;
  open_count: number;
  click_count: number;
  picks: CockpitPick[];
  candidates: CockpitCandidate[];
}

export interface ArchiveRow {
  edition_date: string;
  edition_type: EditionType;
  status: string;
  subject: string | null;
  sent_count: number;
  open_count: number;
  click_count: number;
}
