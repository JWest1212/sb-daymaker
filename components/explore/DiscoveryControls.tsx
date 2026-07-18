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
  onHorizonChange,
  resultCount,
}: {
  onOpenSheet: (dimension: Dimension) => void;
  chips: ActiveChip[];
  onRemoveChip: (dimension: Dimension) => void;
  onResetChips: () => void;
  horizon: Horizon;
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
      <div className="sbd-disco__axis">
        <span className="sbd-disco__axis-label" aria-hidden="true">When</span>
        <HorizonSegment horizon={horizon} onChange={onHorizonChange} />
      </div>
      {typeof resultCount === "number" ? (
        <div className="sbd-disco__count" aria-live="polite">
          {resultCount} {resultCount === 1 ? "thing" : "things"}
        </div>
      ) : null}
    </div>
  );
}
