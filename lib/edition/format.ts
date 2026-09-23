// lib/edition/format.ts, small display-formatting helpers shared by the
// drafter (copy tokens) and the renderer (locator text).

import { AREA_BY_KEY, areaForNeighborhood } from "@/lib/areas";

/** "funk_zone" -> "Funk Zone". Snake-case enum value -> display label. */
export function titleCaseNeighborhood(snake: string): string {
  // R1 W4.1. The digest says the same thing about an area as Explore, Plan,
  // Saved and the detail page. It used to title-case the raw column, which gave
  // "Mission Canyon" where every other surface said "Mission and Riviera".
  // Falls back to title-casing only for a value outside the 8 areas.
  const key = areaForNeighborhood(snake);
  if (key) return AREA_BY_KEY[key].label;
  return snake.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
