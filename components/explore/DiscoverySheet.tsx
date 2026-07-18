import { BottomSheet } from "@/components/ui/BottomSheet";
import type { Thing } from "@/lib/things";
import type { Horizon } from "@/lib/explore";
import { tilesFor, type Dimension } from "@/lib/tiles";
import { DOOR_META } from "./DiscoveryDoors";

const HORIZON_NOUN: Record<Horizon, string> = {
  today: "today",
  week: "this week",
  weekend: "this weekend",
  month: "this month",
};

/** Home Rework spec §11.2, the bottom sheet of tiles for the open dimension.
 *  Reuses BottomSheet verbatim (scrim, focus trap, Escape, body-scroll lock, the
 *  --shadow-sheet slide) so it's visually continuous with the rest of the app. */
export function DiscoverySheet({
  dimension,
  things,
  horizon,
  selected,
  onSelect,
  onClose,
}: {
  dimension: Dimension | null;
  /** Horizon-scoped things (before vibe/place/activity filtering), tile counts
   *  answer "how many show if I pick this," not "how many after my other filters." */
  things: Thing[];
  horizon: Horizon;
  selected: string | null;
  onSelect: (key: string) => void;
  onClose: () => void;
}) {
  const open = dimension !== null;
  const tiles = dimension ? tilesFor(dimension, things) : [];
  const meta = dimension ? DOOR_META[dimension] : null;

  return (
    <BottomSheet open={open} onClose={onClose} title={meta?.sheetTitle}>
      <div className="sbd-tilegrid">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            className={`sbd-tile sbd-tile--${dimension}${selected === tile.key ? " is-active" : ""}`}
            style={dimension ? { backgroundImage: `var(--sbd-door-scrim-${dimension}), url(${tile.image})` } : undefined}
            onClick={() => onSelect(tile.key)}
          >
            <span className="sbd-tile__label">{tile.label}</span>
            <span className="sbd-tile__count">
              {tile.count} {HORIZON_NOUN[horizon]}
            </span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
