import type { Dimension } from "@/lib/tiles";

export const DOOR_META: Record<
  Dimension,
  { kicker: string; label: string; sheetTitle: string; ariaLabel: string; tile: string }
> = {
  place: {
    kicker: "Explore",
    label: "Place",
    sheetTitle: "Where to?",
    ariaLabel: "Filter by place",
    tile: "/tiles/door/place.jpg",
  },
  vibe: {
    kicker: "PERFECT FOR",
    label: "Occasion",
    sheetTitle: "What are you up to?",
    ariaLabel: "Filter by occasion",
    tile: "/tiles/door/vibe.jpg",
  },
  activity: {
    kicker: "Pick a thing",
    label: "Activity",
    sheetTitle: "What are you after?",
    ariaLabel: "Filter by activity",
    tile: "/tiles/door/activity.jpg",
  },
};

const DIMENSIONS: Dimension[] = ["place", "vibe", "activity"];

/** Home Rework spec §11.1 — the three photographic discovery doors. Each door's
 *  background layers a dimension-tinted scrim OVER its photo in one CSS
 *  `background-image` (comma-separated layers): if the photo 404s (true for every
 *  door until Jim supplies real photography — spec §6.3), the gradient layer alone
 *  still renders — no JS/onError needed, the door just reads as a token-tinted tile. */
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
            style={{ backgroundImage: `var(--sbd-door-scrim-${d}), url(${meta.tile})` }}
            aria-label={meta.ariaLabel}
            onClick={() => onOpen(d)}
          >
            <span className="sbd-door__kick">{meta.kicker}</span>
            <span className="sbd-door__label">{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}
