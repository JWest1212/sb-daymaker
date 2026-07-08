// Living Postcard — sketch asset registry (Phase 1 scaffold, Phase 2 populated).
//
// Types + a lookup. The funk-zone entry was added in Phase 2: the base SVG
// Component (FunkZoneSketch in components/discover/) renders everything except
// the numbered marker circles (streets, tracks, coastline, route dashes, ✵,
// plate, compass, STEARNS WHARF →). The marker circles are rendered as an
// overlay layer by GuideWalkSection so Phase 3 can recolor per-stop
// (terracotta → sage for been) without touching the SVG art.
//
// Marker x/y are raw SVG coordinates in the 360×330 viewBox (matching the
// mockup cx/cy pairs verbatim). secretMark is the ✵ glyph position.

import type { ComponentType } from "react";
import { FunkZoneSketch } from "@/components/discover/FunkZoneSketch";
import { StateStreetSketch } from "@/components/discover/StateStreetSketch";

/** Marker position in the SVG coordinate space (viewBox 360×330). */
export interface ArtMarker {
  x: number;
  y: number;
}

/** A registered sketch/emblem asset. `markers` maps a stop position (string
 *  key "1"–"9") to its center point; `secretMark` is the ✵ placement. */
export interface GuideArt {
  kind: "sketch" | "emblem";
  /** Base SVG component — renders art WITHOUT marker circles. */
  Component: ComponentType<{ className?: string }>;
  markers: Record<string, ArtMarker>;
  secretMark?: ArtMarker;
}

// ─── Registry ────────────────────────────────────────────────────────────────

const REGISTRY: Record<string, GuideArt> = {
  "funk-zone": {
    kind: "sketch",
    Component: FunkZoneSketch,
    // cx/cy from mockup viewBox 360×330 — keyed by stop position
    markers: {
      "1": { x: 96, y: 130 },   // Helena Avenue Bakery
      "2": { x: 54, y: 66 },    // MOXI
      "3": { x: 88, y: 190 },   // The mural walls
      "4": { x: 152, y: 110 },  // Pali Wine Co.
      "5": { x: 183, y: 122 },  // Santa Barbara Wine Collective
      "6": { x: 158, y: 152 },  // Topa Topa Brewing Co.
      "7": { x: 141, y: 180 },  // Lucky Penny
      "8": { x: 168, y: 187 },  // The Lark
      "9": { x: 152, y: 288 },  // The sand
    },
    secretMark: { x: 126, y: 177 },
  },
  "state-street": {
    kind: "sketch",
    Component: StateStreetSketch,
    // cx/cy from mockup viewBox 360×330 — keyed by stop position (spec §5)
    markers: {
      "1": { x: 136, y: 74 },   // Caje
      "2": { x: 182, y: 68 },   // The Arlington Theatre
      "3": { x: 70, y: 94 },    // Santa Barbara Public Market
      "4": { x: 208, y: 122 },  // The Book Den
      "5": { x: 256, y: 140 },  // Santa Barbara County Courthouse
      "6": { x: 156, y: 148 },  // La Arcada Courtyard
      "7": { x: 236, y: 210 },  // El Presidio de Santa Barbara
      "8": { x: 298, y: 216 },  // Palihouse
      "9": { x: 256, y: 260 },  // Paloma
    },
    secretMark: { x: 271, y: 114 },
  },
};

/** Look up a sketch/emblem asset by id. Returns null for unknown ids so callers
 *  render a graceful fallback. */
export function getGuideArt(id: string | null | undefined): GuideArt | null {
  if (!id) return null;
  return REGISTRY[id] ?? null;
}
