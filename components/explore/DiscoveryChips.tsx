import type { Dimension } from "@/lib/tiles";

export interface ActiveChip {
  dimension: Dimension;
  label: string;
}

/** Home Rework spec §11.3, the collapsed active-filter chip bar. One chip per
 *  active dimension, dimension-tinted, independently removable; a Reset clears
 *  all. Renders nothing when no dimension is active. */
export function DiscoveryChips({
  chips,
  onRemove,
  onReset,
}: {
  chips: ActiveChip[];
  onRemove: (dimension: Dimension) => void;
  onReset: () => void;
}) {
  if (chips.length === 0) return null;

  return (
    <div className="sbd-chipbar">
      {chips.map((c) => (
        <span key={c.dimension} className={`sbd-fchip sbd-fchip--${c.dimension}`}>
          {c.label}
          <button
            type="button"
            className="sbd-fchip__x"
            aria-label={`Remove ${c.label} filter`}
            onClick={() => onRemove(c.dimension)}
          >
            ×
          </button>
        </span>
      ))}
      {chips.length > 1 ? (
        <button type="button" className="sbd-fchip-reset" onClick={onReset}>
          Reset
        </button>
      ) : null}
    </div>
  );
}
