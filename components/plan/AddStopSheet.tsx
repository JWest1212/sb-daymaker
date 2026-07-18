"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";
import { planZoneLabel, BLOCK_LABEL } from "@/lib/plan/labels";
import { rankCandidates, type RankedThing } from "@/lib/plan/rankCandidates";
import type { Block, PlanAnswers } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

const PAGE = 10;

function formatClockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

interface AddStopSheetProps {
  block: Block;
  answers: PlanAnswers;
  things: Thing[];
  onAdd: (thing: Thing, fromSaved: boolean) => void;
  onClose: () => void;
}

export function AddStopSheet({
  block,
  answers,
  things,
  onAdd,
  onClose,
}: AddStopSheetProps) {
  const { state } = useSaves();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const [savedVisible,  setSavedVisible]  = useState(PAGE);
  const [tier1Visible,  setTier1Visible]  = useState(PAGE);
  const [tier2Visible,  setTier2Visible]  = useState(PAGE);
  const [tier3Visible,  setTier3Visible]  = useState(PAGE);

  const ranked = useMemo<RankedThing[]>(
    () => rankCandidates(block, answers, things, (id) => (state(id) as "want" | "been" | null) ?? null),
    [things, block, answers, state],
  );

  const savedBand = ranked.filter((r) => r.savedState !== null);
  const savedIds  = new Set(savedBand.map((r) => r.thing.id));

  const tier1Band = ranked.filter((r) => !savedIds.has(r.thing.id) && r.thing.happening_tier === 1);
  const tier2Band = ranked.filter((r) => !savedIds.has(r.thing.id) && r.thing.happening_tier === 2);
  const tier3Band = ranked.filter((r) => !savedIds.has(r.thing.id) && r.thing.happening_tier === 3);

  const totalVisible = savedBand.length + tier1Band.length + tier2Band.length + tier3Band.length;

  function handleAdd(thing: Thing, fromSaved: boolean) {
    if (pendingId) return;
    setPendingId(thing.id);
    setTimeout(() => onAdd(thing, fromSaved), 300);
  }

  const blockLabel = BLOCK_LABEL[block];

  function renderRow(r: RankedThing, fromSaved: boolean) {
    const zone    = r.thing.nearby_zone ? planZoneLabel(r.thing.nearby_zone) : null;
    const meta    = [zone ? `📍 ${zone}` : null, r.thing.reason_to_go].filter(Boolean).join(" · ");
    const timeStr = r.thing.starts_at ? formatClockTime(r.thing.starts_at) : null;
    const isPending = pendingId === r.thing.id;

    return (
      <div key={r.thing.id} className="sbd-swapopt">
        <button
          type="button"
          className="sbd-swapopt__select"
          onClick={() => handleAdd(r.thing, fromSaved)}
          aria-label={`Add ${r.thing.title}`}
          disabled={pendingId !== null}
        >
          {r.thing.photo_url ? (
            <img className="sbd-swapopt__thumb" src={r.thing.photo_url} alt="" loading="lazy" />
          ) : (
            <div className="sbd-swapopt__thumb sbd-media--sage" aria-hidden="true" />
          )}
          <div className="sbd-swapopt__body">
            <span className="sbd-swapopt__nm">
              {r.thing.title}
              {fromSaved && r.savedState === "been" ? (
                <span className="sbd-swapopt__badge">Been</span>
              ) : fromSaved ? (
                <span className="sbd-swapopt__badge">♥ Saved</span>
              ) : null}
            </span>
            {timeStr ? <span className="sbd-swapopt__time">{timeStr}</span> : null}
            {meta    ? <span className="sbd-swapopt__mt">{meta}</span>    : null}
          </div>
        </button>
        <Link
          href={`/thing/${r.thing.id}`}
          className="sbd-swapopt__info"
          aria-label={`Details for ${r.thing.title}`}
          onClick={(e) => e.stopPropagation()}
        >
          <span aria-hidden="true">i</span>
        </Link>
        <button
          type="button"
          className="sbd-swapopt__ck"
          onClick={() => handleAdd(r.thing, fromSaved)}
          aria-label={`Add ${r.thing.title}`}
          disabled={pendingId !== null}
        >
          {isPending ? "✓" : "+"}
        </button>
      </div>
    );
  }

  function renderSection(
    items: RankedThing[],
    fromSaved: boolean,
    icon: string,
    label: string,
    mod: string,
    visible: number,
    showMore: () => void,
  ) {
    if (items.length === 0) return null;
    const slice = items.slice(0, visible);
    const remaining = items.length - visible;
    const nextBatch = Math.min(PAGE, remaining);

    return (
      <>
        <div className={`sbd-picker-section sbd-picker-section--${mod}`}>
          <span className="sbd-picker-section__label">
            <span aria-hidden="true">{icon}</span>
            {label}
          </span>
        </div>
        {slice.map((r) => renderRow(r, fromSaved))}
        {remaining > 0 ? (
          <button type="button" className="sbd-showmore" onClick={showMore}>
            Show {nextBatch} more
          </button>
        ) : null}
      </>
    );
  }

  return (
    <BottomSheet
      open
      onClose={onClose}
      kicker={`Adding to your ${blockLabel.toLowerCase()}.`}
      title="Add a stop"
    >
      {renderSection(savedBand, true, "♥", "From your saved", "saved", savedVisible, () => setSavedVisible((n) => n + PAGE))}
      {renderSection(tier1Band, false, "🎫", "Happening at this time", "tier1", tier1Visible, () => setTier1Visible((n) => n + PAGE))}
      {renderSection(tier2Band, false, "🔄", "On the regular", "tier2", tier2Visible, () => setTier2Visible((n) => n + PAGE))}
      {renderSection(tier3Band, false, "⭐", "Always worth it", "tier3", tier3Visible, () => setTier3Visible((n) => n + PAGE))}

      {totalVisible === 0 ? (
        <p className="sbd-swap-empty">
          No spots found for this time, check back as more content is added.
        </p>
      ) : null}
    </BottomSheet>
  );
}
