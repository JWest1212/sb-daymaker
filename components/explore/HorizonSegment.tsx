import { SegmentedControl } from "@/components/ui";
import { HORIZONS, HORIZON_PILL, horizonRangeLabel, type Horizon } from "@/lib/explore";

/**
 * R1 W6.2 (D7). The WHEN row: six pills in the locked order, Today through
 * Month.
 *
 * Each pill's accessible name carries the dates it covers, because "Weekend" on
 * its own does not say WHICH weekend, and "Next Wknd" says even less. A screen
 * reader now hears "Weekend, September 26 to September 28".
 *
 * `nowMs` is passed in rather than read here so the server and the first client
 * render agree on the dates (the labels are date-derived, and a mismatch is a
 * hydration error).
 */
export function HorizonSegment({
  horizon,
  onChange,
  nowMs,
}: {
  horizon: Horizon;
  onChange: (h: Horizon) => void;
  nowMs: number;
}) {
  return (
    <div className="sbd-horizon">
      <SegmentedControl
        ariaLabel="When"
        value={horizon}
        onChange={(v) => onChange(v as Horizon)}
        options={HORIZONS.map((h) => ({
          label: HORIZON_PILL[h],
          value: h,
          ariaLabel: `${HORIZON_PILL[h]}, ${horizonRangeLabel(h, nowMs)}`,
        }))}
      />
    </div>
  );
}
