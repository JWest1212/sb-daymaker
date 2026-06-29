"use client";

import Link from "next/link";
import { SaveHeart } from "@/components/ui/SaveHeart";
import { useSaves } from "@/components/saves/SavesProvider";
import { planZoneLabel } from "@/lib/plan/labels";
import type { Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

// Format a real starts_at ISO datetime as a clock time in SB local time.
function formatClockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

interface SpineStopCardProps {
  stop: Stop;
  thing: Thing;
  onRemove: () => void;
}

export function SpineStopCard({ stop, thing, onRemove }: SpineStopCardProps) {
  const { isSaved, toggle } = useSaves();
  const saved = isSaved(thing.id);

  const zone = thing.nearby_zone ? planZoneLabel(thing.nearby_zone) : null;
  const meta = [zone ? `📍 ${zone}` : null, thing.reason_to_go]
    .filter(Boolean)
    .join(" · ");

  // Rule 3: only show a time if the thing has a real starts_at datetime.
  const timeStr = thing.starts_at ? formatClockTime(thing.starts_at) : null;

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
        {timeStr ? (
          <span className="sbd-scard__eb">{timeStr}</span>
        ) : null}
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

      {/* Acts column */}
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
          className="sbd-scard__remove"
          aria-label={`Remove ${thing.title}`}
          onClick={onRemove}
        >
          ×
        </button>
      </div>
    </div>
  );
}
