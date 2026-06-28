"use client";

import Link from "next/link";
import { SaveHeart } from "@/components/ui/SaveHeart";
import { useSaves } from "@/components/saves/SavesProvider";
import { BLOCK_TIME_LABEL } from "@/lib/plan/buildDay";
import { planZoneLabel } from "@/lib/plan/labels";
import type { Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

interface SpineStopCardProps {
  stop: Stop;
  thing: Thing;
  onSwap: () => void;
}

export function SpineStopCard({ stop, thing, onSwap }: SpineStopCardProps) {
  const { isSaved, toggle } = useSaves();
  const saved = isSaved(thing.id);

  const zone = thing.nearby_zone ? planZoneLabel(thing.nearby_zone) : null;
  const meta = [zone ? `📍 ${zone}` : null, thing.reason_to_go]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="sbd-scard">
      {/* Thumb */}
      {thing.photo_url ? (
        <img
          className="sbd-scard__thumb"
          src={thing.photo_url}
          alt=""
          loading="lazy"
        />
      ) : (
        <div className="sbd-scard__thumb sbd-media--sage" aria-hidden="true" />
      )}

      {/* Body — stretch link lives on the title for full-card tap */}
      <div className="sbd-scard__body">
        <span className="sbd-scard__eb">{BLOCK_TIME_LABEL[stop.block]}</span>
        <h3 className="sbd-scard__nm">
          <Link href={`/thing/${thing.id}`} className="sbd-stretch">
            {thing.title}
          </Link>
        </h3>
        {meta ? <span className="sbd-scard__mt">{meta}</span> : null}
        {stop.fromSaved ? (
          <span className="sbd-scard__savedchip">♥ Saved</span>
        ) : null}
      </div>

      {/* Acts column — sits above stretch overlay via z-index */}
      <div className="sbd-scard__acts">
        <div className="sbd-scard__acttop">
          {/* ⓘ info — visual affordance; stretch link is the keyboard path */}
          <Link
            href={`/thing/${thing.id}`}
            className="sbd-scard__info"
            aria-label={`Details for ${thing.title}`}
            tabIndex={-1}
            aria-hidden="true"
          >
            <span aria-hidden="true">i</span>
          </Link>
          <SaveHeart
            saved={saved}
            onToggle={() => toggle(thing.id)}
            title={thing.title}
          />
        </div>
        <button
          type="button"
          className="sbd-scard__swap"
          aria-label={`Swap ${stop.block} stop`}
          onClick={onSwap}
        >
          ⇄ Swap
        </button>
      </div>
    </div>
  );
}
