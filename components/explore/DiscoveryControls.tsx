import type { Horizon } from "@/lib/explore";
import type { Dimension } from "@/lib/tiles";
import { DiscoveryDoors } from "./DiscoveryDoors";
import { DiscoveryChips, type ActiveChip } from "./DiscoveryChips";
import { HorizonSegment } from "./HorizonSegment";

/** Home Rework spec §8/§11, doors + chip bar + horizon, pinned directly beneath
 *  the header (`top: var(--sbd-header-h)`, the same token-driven offset the
 *  existing sticky section headers already use, no new CSS variable needed). */
export function DiscoveryControls({
  onOpenSheet,
  chips,
  onRemoveChip,
  onResetChips,
  horizon,
  nowMs,
  onHorizonChange,
  resultCount,
}: {
  onOpenSheet: (dimension: Dimension) => void;
  chips: ActiveChip[];
  onRemoveChip: (dimension: Dimension) => void;
  onResetChips: () => void;
  horizon: Horizon;
  /** R1 W6.2. Server-supplied clock, so the date-derived pill labels do not
   *  differ between the server render and hydration. */
  nowMs: number;
  onHorizonChange: (h: Horizon) => void;
  /** Elevation v1 · Gate 3 · G3.8, live count of things matching the current
   *  door + horizon selection. Updates on every filter change. */
  resultCount?: number;
}) {
  return (
    <div className="sbd-disco">
      {/* G3.8, the two axes are visually separated + labelled: the "doors" (Place /
          Occasion / Activity) are the category axis, the segmented control below is
          the time axis. */}
      <DiscoveryDoors onOpen={onOpenSheet} />
      <DiscoveryChips chips={chips} onRemove={onRemoveChip} onReset={onResetChips} />
      <HorizonSegment horizon={horizon} onChange={onHorizonChange} nowMs={nowMs} />
      {typeof resultCount === "number" ? (
        <div className="sbd-disco__count" aria-live="polite">
          {resultCount} {resultCount === 1 ? "thing" : "things"}
        </div>
      ) : null}
    </div>
  );
}
