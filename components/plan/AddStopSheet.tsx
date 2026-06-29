"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { BottomSheet } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";
import { planZoneLabel, BLOCK_LABEL } from "@/lib/plan/labels";
import type { Block, PlanAnswers } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

const PAGE = 10;

// ---------------------------------------------------------------------------
// Time helpers
// ---------------------------------------------------------------------------

function formatClockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

function sameDay(iso: string, dateISO: string): boolean {
  return (
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(
      new Date(iso),
    ) === dateISO
  );
}

// Returns [startHour, endHour) in 24h SB local time for a block.
//   morning:   midnight – noon      (0–12)
//   afternoon: noon – 4 pm          (12–16)
//   evening:   4 pm – 7 pm          (16–19)
//   late:      7 pm – midnight       (19–24)
function blockHourRange(block: Block): [number, number] {
  switch (block) {
    case "morning":   return [0,  12];
    case "afternoon": return [12, 16];
    case "evening":   return [16, 19];
    case "late":      return [19, 24];
  }
}

function inBlockWindow(iso: string, block: Block): boolean {
  const hour = new Date(iso).toLocaleString("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    hour12: false,
  });
  const h = parseInt(hour, 10);
  const [lo, hi] = blockHourRange(block);
  return h >= lo && h < hi;
}

// ---------------------------------------------------------------------------
// Ranking
// ---------------------------------------------------------------------------

function whoBoost(who: PlanAnswers["who"], t: Thing): boolean {
  if (who === "solo"    && t.tags.includes("solo")) return true;
  if (who === "family"  && t.tags.includes("family_day") && !t.is_21_plus) return true;
  if (who === "couple"  && t.tags.includes("date_night")) return true;
  if (who === "friends" && t.tags.includes("nightlife")) return true;
  return false;
}

interface RankedThing {
  thing: Thing;
  score: number;
  savedState: "want" | "been" | null;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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

  // Show-more counters per section (reset when block/answers changes via key on parent)
  const [savedVisible,  setSavedVisible]  = useState(PAGE);
  const [tier1Visible,  setTier1Visible]  = useState(PAGE);
  const [tier2Visible,  setTier2Visible]  = useState(PAGE);
  const [tier3Visible,  setTier3Visible]  = useState(PAGE);

  const ranked = useMemo<RankedThing[]>(() => {
    return things
      .filter((t) => {
        // Nightlife-tagged things are never appropriate for a morning slot.
        if (block === "morning" && (t.tags as string[]).includes("nightlife")) return false;
        // If the thing has a real start time, only include it when that time
        // falls on the chosen date AND within this block's time window.
        if (t.starts_at) {
          return sameDay(t.starts_at, answers.dateISO) && inBlockWindow(t.starts_at, block);
        }
        // Recurring / evergreen (no specific start time) always pass the time filter.
        return true;
      })
      .map((t) => {
        let s = 0;
        if (t.time_of_day_fit?.includes(block)) s += 3;
        if (answers.vibes.some((v) => (t.tags as string[]).includes(v))) s += 3;
        if (whoBoost(answers.who, t)) s += 1;
        if (answers.zone && t.nearby_zone === answers.zone) s += 2;
        if (t.starts_at) s += 2; // dated-on-date already guaranteed by filter above
        const savedState = (state(t.id) as "want" | "been" | null) ?? null;
        return { thing: t, score: s, savedState };
      })
      .sort(
        (a, b) =>
          (b.savedState ? 1 : 0) - (a.savedState ? 1 : 0) || b.score - a.score,
      );
  }, [things, block, answers, state]);

  // Section 1: saved (both save states), ordered by score
  const savedBand = ranked.filter((r) => r.savedState !== null);
  const savedIds  = new Set(savedBand.map((r) => r.thing.id));

  // Sections 2–4: unsaved, split by happening_tier
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

  // ---------------------------------------------------------------------------
  // Row renderer
  // ---------------------------------------------------------------------------
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

  // ---------------------------------------------------------------------------
  // Section renderer — header + paged rows + show-more pill
  // ---------------------------------------------------------------------------
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
          <button
            type="button"
            className="sbd-showmore"
            onClick={showMore}
          >
            Show {nextBatch} more
          </button>
        ) : null}
      </>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <BottomSheet
      open
      onClose={onClose}
      kicker={`Adding to your ${blockLabel.toLowerCase()}.`}
      title="Add a stop"
    >
      {renderSection(
        savedBand,
        true,
        "♥",
        "From your saved",
        "saved",
        savedVisible,
        () => setSavedVisible((n) => n + PAGE),
      )}

      {renderSection(
        tier1Band,
        false,
        "🎫",
        "Happening at this time",
        "tier1",
        tier1Visible,
        () => setTier1Visible((n) => n + PAGE),
      )}

      {renderSection(
        tier2Band,
        false,
        "🔄",
        "On the regular",
        "tier2",
        tier2Visible,
        () => setTier2Visible((n) => n + PAGE),
      )}

      {renderSection(
        tier3Band,
        false,
        "⭐",
        "Always worth it",
        "tier3",
        tier3Visible,
        () => setTier3Visible((n) => n + PAGE),
      )}

      {totalVisible === 0 ? (
        <p className="sbd-swap-empty">
          No spots found for this time — check back as more content is added.
        </p>
      ) : null}
    </BottomSheet>
  );
}
