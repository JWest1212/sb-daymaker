import type { Block } from "./types";
import type { Zone } from "@/lib/zones";
import { ZONE_LABEL } from "@/lib/zones";

/** Human-readable zone label for the plan surface. Handles null (Anywhere → "SB"). */
export function planZoneLabel(zone: Zone | null): string {
  if (!zone) return "SB";
  return ZONE_LABEL[zone] ?? zone;
}

const BLOCK_SHORT_MAP: Record<Block, string> = {
  morning:   "MORNING",
  afternoon: "AFTERNOON",
  night:     "NIGHT",
};

/** Uppercase block name for the spine subline (e.g. MORNING → NIGHT). */
export function blockShortName(block: Block): string {
  return BLOCK_SHORT_MAP[block];
}

/** Display label for a block (title case). Used in section headers and picker kicker. */
export const BLOCK_LABEL: Record<Block, string> = {
  morning:   "Morning",
  afternoon: "Afternoon",
  night:     "Night",
};
