"use client";

import Link from "next/link";
import type { Thing } from "@/lib/things";
import type { SaveState } from "@/components/saves/SavesProvider";
import { Tag } from "@/components/ui";
import { cardTag, cardFacts, cardTone } from "@/components/explore/derive";

export function SavedCard({
  thing,
  index,
  state,
  selectMode,
  selected,
  onToggleSelect,
  onSetState,
  onRemove,
  onShareOne,
}: {
  thing: Thing;
  index: number;
  state: SaveState;
  selectMode: boolean;
  selected: boolean;
  onToggleSelect: () => void;
  onSetState: (s: SaveState) => void;
  onRemove: () => void;
  onShareOne: () => void;
}) {
  const tag = cardTag(thing);
  const meta = cardFacts(thing).join(" · ");

  return (
    <article
      className={`sbd-card sbd-savedcard${selected ? " is-selected" : ""}`}
      onClick={selectMode ? onToggleSelect : undefined}
      role={selectMode ? "button" : undefined}
      aria-pressed={selectMode ? selected : undefined}
    >
      {selectMode ? (
        <div className="sbd-savedcard__top">
          <span className="sbd-savedcard__check" aria-hidden="true">
            {selected ? "✓" : ""}
          </span>
          <div
            className={`sbd-savedcard__thumb sbd-media--${cardTone(index)}`}
            aria-hidden="true"
          >
            {thing.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sbd-card__img" src={thing.photo_url} alt="" loading="lazy" />
            ) : null}
          </div>
          <div className="sbd-savedcard__body">
            {tag ? <Tag color="sage" micro>{tag}</Tag> : null}
            <h3 className="sbd-savedcard__title">{thing.title}</h3>
            {meta ? <div className="sbd-savedcard__meta">{meta}</div> : null}
          </div>
        </div>
      ) : (
        /* Card body tap → opens detail screen */
        <Link href={`/thing/${thing.id}`} className="sbd-savedcard__top sbd-savedcard__top--link">
          <div
            className={`sbd-savedcard__thumb sbd-media--${cardTone(index)}`}
            aria-hidden="true"
          >
            {thing.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sbd-card__img" src={thing.photo_url} alt="" loading="lazy" />
            ) : null}
          </div>
          <div className="sbd-savedcard__body">
            {tag ? <Tag color="sage" micro>{tag}</Tag> : null}
            <h3 className="sbd-savedcard__title">{thing.title}</h3>
            {meta ? <div className="sbd-savedcard__meta">{meta}</div> : null}
          </div>
        </Link>
      )}

      {!selectMode ? (
        /* C1: three equal-weight, quiet controls — no dominant pill */
        <div className="sbd-savedcard__actions">
          <button
            type="button"
            className={`sbd-savedcard__act sbd-savedcard__act--been${state === "been" ? " is-been" : ""}`}
            aria-pressed={state === "been"}
            aria-label={state === "been" ? `Mark ${thing.title} as want to go` : `Mark ${thing.title} as been`}
            onClick={(e) => {
              e.stopPropagation();
              onSetState(state === "been" ? "want" : "been");
            }}
          >
            {state === "been" ? "↩ Want to go" : "✓ Mark been"}
          </button>
          <button
            type="button"
            className="sbd-savedcard__act"
            onClick={(e) => { e.stopPropagation(); onShareOne(); }}
            aria-label={`Share ${thing.title}`}
            data-tooltip="Share"
          >
            ↗
          </button>
          <button
            type="button"
            className="sbd-savedcard__act sbd-savedcard__act--remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={`Remove ${thing.title}`}
            data-tooltip="Remove"
          >
            ✕
          </button>
        </div>
      ) : null}
    </article>
  );
}
