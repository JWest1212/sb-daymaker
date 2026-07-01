import { SegmentedControl, SBIcon } from "@/components/ui";
import type { OccasionKey } from "@/lib/occasions";
import type { Zone } from "@/lib/zones";
import type { Horizon } from "@/lib/explore";

export function ControlRow({
  lens,
  zone,
  horizon,
  tuneOpen,
  onOpenTune,
  onHorizon,
}: {
  lens: OccasionKey | null;
  zone: Zone | null;
  horizon: Horizon;
  tuneOpen: boolean;
  onOpenTune: () => void;
  onHorizon: (h: Horizon) => void;
}) {
  const activeFilterCount = (lens ? 1 : 0) + (zone ? 1 : 0);
  const isActive = activeFilterCount > 0;

  return (
    <div className="sbd-ctrl">
      <div className="sbd-ctrl__horizon">
        <SegmentedControl
          ariaLabel="Time horizon"
          value={horizon}
          onChange={(v) => onHorizon(v as Horizon)}
          options={[
            { label: "Today", value: "today" },
            { label: "This Week", value: "week" },
            { label: "This Month", value: "month" },
          ]}
        />
      </div>
      <button
        type="button"
        className={`sbd-ctrl__tune${isActive ? " is-active" : ""}`}
        aria-haspopup="dialog"
        aria-expanded={tuneOpen}
        onClick={onOpenTune}
      >
        <SBIcon name="sliders" size={15} stroke="var(--pacific)" strokeWidth={2} />
        <span>Tune</span>
        {isActive ? (
          <span
            className="sbd-ctrl__tune-dot"
            aria-label={`${activeFilterCount} filter${activeFilterCount > 1 ? "s" : ""} active`}
          >
            {activeFilterCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
