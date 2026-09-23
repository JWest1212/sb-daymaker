import { ACTIVITY, ACTIVITY_SHEET_TITLE, AREA, AREA_SHEET_TITLE, OCCASION, OCCASION_SHEET_TITLE } from "@/lib/strings";
import type { Dimension } from "@/lib/tiles";

// Performance pass (2026-09-22): WebP at display size, 925 KB of JPEG down to
// 72 KB for the three doors (the .jpg originals stay in public/ as sources).
export const DOOR_META: Record<
  Dimension,
  { label: string; sheetTitle: string; ariaLabel: string; tile: string }
> = {
  place: {
    label: AREA,
    sheetTitle: AREA_SHEET_TITLE,
    ariaLabel: "Filter by area",
    tile: "/tiles/door/place.webp",
  },
  vibe: {
    label: OCCASION,
    sheetTitle: OCCASION_SHEET_TITLE,
    ariaLabel: "Filter by occasion",
    tile: "/tiles/door/vibe.webp",
  },
  activity: {
    label: ACTIVITY,
    sheetTitle: ACTIVITY_SHEET_TITLE,
    ariaLabel: "Filter by activity",
    tile: "/tiles/door/activity.webp",
  },
};

const DIMENSIONS: Dimension[] = ["place", "vibe", "activity"];

/** Home Rework spec §11.1, the three photographic discovery doors. */
export function DiscoveryDoors({ onOpen }: { onOpen: (dimension: Dimension) => void }) {
  return (
    <div className="sbd-doors">
      {DIMENSIONS.map((d) => {
        const meta = DOOR_META[d];
        return (
          <button
            key={d}
            type="button"
            className={`sbd-door sbd-door--${d}`}
            style={{ backgroundImage: `url(${meta.tile})` }}
            aria-label={meta.ariaLabel}
            onClick={() => onOpen(d)}
          >
            <span className="sbd-door__scrim" aria-hidden="true" />
            <span className="sbd-door__label">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
