import type { Horizon } from "@/lib/explore";
import type { Dimension } from "@/lib/tiles";
import { DiscoveryDoors } from "./DiscoveryDoors";
import { DiscoveryChips, type ActiveChip } from "./DiscoveryChips";
import { HorizonSegment } from "./HorizonSegment";

/** Home Rework spec §8/§11 — doors + chip bar + horizon, pinned directly beneath
 *  the header (`top: var(--sbd-header-h)`, the same token-driven offset the
 *  existing sticky section headers already use — no new CSS variable needed). */
export function DiscoveryControls({
  onOpenSheet,
  chips,
  onRemoveChip,
  onResetChips,
  horizon,
  onHorizonChange,
}: {
  onOpenSheet: (dimension: Dimension) => void;
  chips: ActiveChip[];
  onRemoveChip: (dimension: Dimension) => void;
  onResetChips: () => void;
  horizon: Horizon;
  onHorizonChange: (h: Horizon) => void;
}) {
  return (
    <div className="sbd-disco">
      <DiscoveryDoors onOpen={onOpenSheet} />
      <DiscoveryChips chips={chips} onRemove={onRemoveChip} onReset={onResetChips} />
      <HorizonSegment horizon={horizon} onChange={onHorizonChange} />
    </div>
  );
}
