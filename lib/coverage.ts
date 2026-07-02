// lib/coverage.ts
//
// Client-safe coverage types + the RAG shading math for the Cockpit v2 Coverage
// heatmap. Occurrence counting lives in lib/occurrences.ts; this module turns a
// column of counts into red/amber/green shading. Server aggregation (service-role
// reads) lives in lib/coverageServer.ts.

import { COVERAGE_WINDOWS, type CoverageWindow } from "./occurrences";

export { COVERAGE_WINDOWS };
export type { CoverageWindow };

export type CoverageDim = "vibe" | "zone";

export interface CoverageRow {
  key: string;
  label: string;
  evergreen: number; // Tier-3 count behind the row (annotation only; not in RAG math)
  windows: Record<CoverageWindow, number>;
}

export interface CoverageResult {
  dim: CoverageDim;
  rows: CoverageRow[];
  generatedAt: string;
}

/** One item in a cell drilldown. */
export interface CoverageCellItem {
  id: string;
  title: string;
  tier: number;
  when: string;      // next occurrence / cadence string
  occurrences: number; // count within the requested window
}

// Absolute floors (§1.3): a cell under the floor is red regardless of rank.
// On by default in the UI; lives here so there's one source of truth.
export const COVERAGE_FLOORS: Record<CoverageWindow, number> = { 7: 3, 14: 5, 30: 8, 45: 10 };

export type Rag = "r" | "a" | "g";
export interface CellShade { rag: Rag; deep: boolean; }

/** Percentile value from an ascending-sorted array (nearest-rank). */
function pct(sortedAsc: number[], q: number): number {
  if (!sortedAsc.length) return 0;
  const i = Math.min(sortedAsc.length - 1, Math.max(0, Math.floor(q * (sortedAsc.length - 1))));
  return sortedAsc[i];
}

/**
 * Shade a whole column (the counts across all rows for one window).
 * Relative within the column: green ≥ 67th pct, amber ≥ 33rd, else red.
 * A zero cell is always red (no coverage is never "stocked"). With `floorOn`,
 * any cell under the window's absolute floor is forced red. Deep tint marks the
 * column max (green) and min (red) so the extremes read at a glance.
 */
export function shadeColumn(values: number[], window: CoverageWindow, floorOn: boolean): CellShade[] {
  const sorted = [...values].sort((a, b) => a - b);
  const p33 = pct(sorted, 0.33);
  const p67 = pct(sorted, 0.67);
  const max = values.length ? Math.max(...values) : 0;
  const min = values.length ? Math.min(...values) : 0;
  return values.map((v) => {
    let rag: Rag = v >= p67 ? "g" : v >= p33 ? "a" : "r";
    if (v === 0) rag = "r";
    if (floorOn && v < COVERAGE_FLOORS[window]) rag = "r";
    const deep = (rag === "g" && v === max && max > 0) || (rag === "r" && v === min);
    return { rag, deep };
  });
}
