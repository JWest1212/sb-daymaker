import { SegmentedControl } from "@/components/ui";
import { OCCASION_BY_KEY, type OccasionKey } from "@/lib/occasions";
import { ZONE_LABEL, type Zone } from "@/lib/zones";
import type { Horizon } from "@/lib/explore";

export function ControlRow({
  lens,
  zone,
  horizon,
  onOpenLens,
  onOpenNearMe,
  onHorizon,
}: {
  lens: OccasionKey | null;
  zone: Zone | null;
  horizon: Horizon;
  onOpenLens: () => void;
  onOpenNearMe: () => void;
  onHorizon: (h: Horizon) => void;
}) {
  const lensSel = lens ? OCCASION_BY_KEY[lens] : null;

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

      <div className="sbd-ctrl__row">
        <button
          type="button"
          className={`sbd-ctrl__lens${lensSel ? " is-active" : ""}`}
          onClick={onOpenLens}
        >
          <span className="sbd-ctrl__lens-icon" aria-hidden="true">
            {lensSel ? lensSel.icon : "✦"}
          </span>
          <span className="sbd-ctrl__lens-text">
            {lensSel ? lensSel.label : "Any vibe"}
          </span>
          <span aria-hidden="true">▾</span>
        </button>

        <button
          type="button"
          className={`sbd-ctrl__near${zone ? " is-active" : ""}`}
          aria-pressed={Boolean(zone)}
          onClick={onOpenNearMe}
        >
          <span aria-hidden="true">📍</span>
          <span>{zone ? ZONE_LABEL[zone] : "Near Me"}</span>
        </button>
      </div>
    </div>
  );
}
