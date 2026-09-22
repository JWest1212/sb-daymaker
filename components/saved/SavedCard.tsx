"use client";

import { WANT_TO_GO } from "@/lib/strings";

import { SBIcon } from "@/components/ui/SBIcon";

import Link from "next/link";
import { thingPath } from "@/lib/seo/site";
import type { Thing } from "@/lib/things";
import type { SaveState } from "@/components/saves/SavesProvider";
import { Tag } from "@/components/ui";
import { cardTag, cardFacts, cardTone, alreadyHappenedLine, imageAlt, recurringWhen } from "@/components/explore/derive";

// R1 W7.1 (TP-A6-04). The interaction model, stated: the TOP region (photo,
// tag, title, meta) is one link to the listing, and the action row beneath it
// is its own thing. The feed card stretches its link over the whole card
// because its only controls float on the photo; this card has a full row of
// controls at its base, and a link stretched under those would make every
// tap a coin toss between "open" and "mark been". Different by design.

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
  nowMs,
}: {
  /** R1 W7.3. The Saved page's mount-time clock, for "already happened". */
  nowMs: number;
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
  // R1 W7.2. A regular says when it next happens, the same way the feed does,
  // instead of a bare price. Falls back to the plain facts when there is no
  // schedule to read.
  const meta = [recurringWhen(thing), ...cardFacts(thing)].filter(Boolean).join(" · ");
  // R1 W1.1. An archived row still renders as a normal saved card, keeping its
  // want/been controls, because "Did you make it?" only works if past items
  // survive. It just says out loud that it is in the past.
  const alreadyHappened = alreadyHappenedLine(thing, nowMs);

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
            {selected ? <SBIcon name="check" size={14} strokeWidth={2.4} /> : null}
          </span>
          <div
            className={`sbd-savedcard__thumb sbd-media--${cardTone(index)}`}
            aria-hidden="true"
          >
            {thing.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sbd-card__img" src={thing.photo_url} alt={imageAlt(thing)} loading="lazy" />
            ) : null}
          </div>
          <div className="sbd-savedcard__body">
            {tag ? <Tag color="sage" micro>{tag}</Tag> : null}
            <h3 className="sbd-savedcard__title">{thing.title}</h3>
            {meta ? <div className="sbd-savedcard__meta">{meta}</div> : null}
            {alreadyHappened ? (
              <div className="sbd-savedcard__past">{alreadyHappened}</div>
            ) : null}
          </div>
        </div>
      ) : (
        /* Card body tap → opens detail screen */
        <Link href={thingPath(thing)} className="sbd-savedcard__top sbd-savedcard__top--link">
          <div
            className={`sbd-savedcard__thumb sbd-media--${cardTone(index)}`}
            aria-hidden="true"
          >
            {thing.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sbd-card__img" src={thing.photo_url} alt={imageAlt(thing)} loading="lazy" />
            ) : null}
          </div>
          <div className="sbd-savedcard__body">
            {tag ? <Tag color="sage" micro>{tag}</Tag> : null}
            <h3 className="sbd-savedcard__title">{thing.title}</h3>
            {meta ? <div className="sbd-savedcard__meta">{meta}</div> : null}
            {alreadyHappened ? (
              <div className="sbd-savedcard__past">{alreadyHappened}</div>
            ) : null}
          </div>
        </Link>
      )}

      {!selectMode ? (
        /* C1: three equal-weight, quiet controls, no dominant pill */
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
            {state === "been" ? <><SBIcon name="heart" size={14} /> {WANT_TO_GO}</> : <><SBIcon name="check" size={14} /> Mark been</>}
          </button>
          <button
            type="button"
            className="sbd-savedcard__act"
            onClick={(e) => { e.stopPropagation(); onShareOne(); }}
            aria-label={`Share ${thing.title}`}
            data-tooltip="Share"
          >
            <SBIcon name="share" size={16} />
          </button>
          <button
            type="button"
            className="sbd-savedcard__act sbd-savedcard__act--remove"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            aria-label={`Remove ${thing.title}`}
            data-tooltip="Remove"
          >
            <SBIcon name="close" size={16} />
          </button>
        </div>
      ) : null}
    </article>
  );
}
