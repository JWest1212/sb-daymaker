import { SegmentedControl } from "@/components/ui";
import type { Horizon } from "@/lib/explore";

/** Home Rework spec §11.5, the Today/Week/Month control, rehomed from the
 *  retired ControlRow into DiscoveryControls. Same control, same behavior. */
export function HorizonSegment({
  horizon,
  onChange,
}: {
  horizon: Horizon;
  onChange: (h: Horizon) => void;
}) {
  return (
    <div className="sbd-horizon">
      <SegmentedControl
        ariaLabel="Time horizon"
        value={horizon}
        onChange={(v) => onChange(v as Horizon)}
        options={[
          { label: "Today", value: "today" },
          { label: "Week", value: "week", ariaLabel: "This Week" },
          // Gate 3 · G3.3, "This weekend" as a first-class horizon.
          { label: "Weekend", value: "weekend", ariaLabel: "This Weekend" },
          { label: "Month", value: "month", ariaLabel: "This Month" },
        ]}
      />
    </div>
  );
}
