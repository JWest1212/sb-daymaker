import type { Block } from "./types";
import { AREA_BY_KEY, type AreaKey } from "@/lib/areas";

/** R1 W4.1/W4.3. The area's own short label, from the one module. Null means
 *  "no area chosen", which reads as the whole city, not as an unknown. */
export function planZoneLabel(zone: AreaKey | null): string {
  if (!zone) return "SB";
  return AREA_BY_KEY[zone]?.short ?? zone;
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
  // R1 W3.6, "Evening" matches the site's greeting vocabulary ("Golden hour",
  // "After dark"); "Night" was the only surface calling it something else.
  night:     "Evening",
};
