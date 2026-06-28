"use client";

import Link from "next/link";
import { BottomSheet } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";
import { BLOCK_TIME_LABEL } from "@/lib/plan/buildDay";
import { planZoneLabel } from "@/lib/plan/labels";
import type { Block } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

interface SwapSheetProps {
  block: Block;
  currentStopId: string | null;
  candidates: Thing[];
  onSelect: (thing: Thing, fromSaved: boolean) => void;
  onClose: () => void;
}

export function SwapSheet({
  block,
  currentStopId,
  candidates,
  onSelect,
  onClose,
}: SwapSheetProps) {
  const { isSaved } = useSaves();

  const saved = candidates.filter((t) => isSaved(t.id));
  const rest = candidates.filter((t) => !isSaved(t.id));

  function renderRow(thing: Thing, fromSaved: boolean) {
    const isCurrent = thing.id === currentStopId;
    const zone = thing.nearby_zone ? planZoneLabel(thing.nearby_zone) : null;
    const meta = [zone ? `📍 ${zone}` : null, thing.reason_to_go]
      .filter(Boolean)
      .join(" · ");

    return (
      <div
        key={thing.id}
        className={`sbd-swapopt${isCurrent ? " sbd-swapopt--sel" : ""}`}
      >
        <button
          type="button"
          className="sbd-swapopt__select"
          onClick={() => onSelect(thing, fromSaved)}
          aria-label={
            isCurrent
              ? `${thing.title} (currently selected)`
              : `Select ${thing.title}`
          }
          aria-pressed={isCurrent}
        >
          {thing.photo_url ? (
            <img
              className="sbd-swapopt__thumb"
              src={thing.photo_url}
              alt=""
              loading="lazy"
            />
          ) : (
            <div
              className="sbd-swapopt__thumb sbd-media--sage"
              aria-hidden="true"
            />
          )}
          <div className="sbd-swapopt__body">
            <span className="sbd-swapopt__nm">
              {thing.title}
              {fromSaved ? (
                <span className="sbd-swapopt__badge">♥ Saved</span>
              ) : null}
            </span>
            {meta ? <span className="sbd-swapopt__mt">{meta}</span> : null}
          </div>
        </button>
        <Link
          href={`/thing/${thing.id}`}
          className="sbd-swapopt__info"
          aria-label={`Details for ${thing.title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden="true">i</span>
        </Link>
        <div className="sbd-swapopt__ck" aria-hidden="true">
          {isCurrent ? "✓" : ""}
        </div>
      </div>
    );
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      kicker={BLOCK_TIME_LABEL[block]}
      title="Swap this stop"
    >
      {saved.length > 0 ? (
        <>
          <div className="sbd-sublabel">
            <span aria-hidden="true">❤️</span> From your saved list
          </div>
          {saved.map((t) => renderRow(t, true))}
        </>
      ) : null}

      {rest.length > 0 ? (
        <>
          <div className="sbd-sublabel">
            More ideas for the {block}
          </div>
          {rest.map((t) => renderRow(t, false))}
        </>
      ) : null}

      {candidates.length === 0 ? (
        <p className="sbd-swap-empty">No other options available right now.</p>
      ) : null}
    </BottomSheet>
  );
}
