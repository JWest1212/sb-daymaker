import type { Dimension } from "@/lib/tiles";

export const DOOR_META: Record<
  Dimension,
  { label: string; sheetTitle: string; ariaLabel: string; tile: string }
> = {
  place: {
    label: "Place",
    sheetTitle: "Where to?",
    ariaLabel: "Filter by place",
    tile: "/tiles/door/place.jpg",
  },
  vibe: {
    label: "Occasion",
    sheetTitle: "What are you up to?",
    ariaLabel: "Filter by occasion",
    tile: "/tiles/door/vibe.jpg",
  },
  activity: {
    label: "Activity",
    sheetTitle: "What are you after?",
    ariaLabel: "Filter by activity",
    tile: "/tiles/door/activity.jpg",
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
