import { BottomSheet } from "@/components/ui";
import { OCCASIONS, type OccasionKey } from "@/lib/occasions";

export function LensSheet({
  open,
  current,
  onClose,
  onSelect,
}: {
  open: boolean;
  current: OccasionKey | null;
  onClose: () => void;
  onSelect: (tag: OccasionKey | null) => void;
}) {
  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      kicker="Tune the feed"
      title="What are you in the mood for?"
    >
      <button
        type="button"
        className={`sbd-lens-any${current === null ? " is-active" : ""}`}
        onClick={() => onSelect(null)}
      >
        ✦ Any vibe — show everything
      </button>

      <div className="sbd-lens-grid">
        {OCCASIONS.map((o) => (
          <button
            key={o.key}
            type="button"
            className={`sbd-lens-opt${current === o.key ? " is-active" : ""}`}
            onClick={() => onSelect(o.key)}
          >
            <span
              className="sbd-lens-opt__pic"
              aria-hidden="true"
              style={{ background: o.color }}
            >
              {o.icon}
            </span>
            <span className="sbd-lens-opt__label">{o.label}</span>
          </button>
        ))}
      </div>
    </BottomSheet>
  );
}
