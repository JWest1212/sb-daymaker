"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import { DayShapeSelector } from "./DayShapeSelector";
import { ItinerarySpine } from "./ItinerarySpine";
import { SwapSheet } from "./SwapSheet";
import { buildDay, rankedCandidates, BLOCK_TIME_LABEL } from "@/lib/plan/buildDay";
import { shortStamp } from "@/lib/plan/dates";
import { PLAN_SELECTOR_SHAPES, DAY_SHAPE_BY_ID } from "@/lib/plan/dayShapes";
import { blockShortName, planZoneLabel } from "@/lib/plan/labels";
import type { ItineraryInput, SavedItinerary } from "@/lib/plan/itineraries";
import type { PlanAnswers, Block, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";
import { createSharedPlan } from "@/lib/shares";
import { shareUrl } from "@/components/saved/share";

interface PlanResultsProps {
  answers: PlanAnswers;
  things: Thing[];
  pinned?: Thing[];
  initialShapeId?: string;
  initialOverrides?: Partial<Record<Block, Stop>>;
  itineraries: SavedItinerary[];
  myPlansOpen?: boolean;
  onSave: (data: ItineraryInput) => string;
  onMyPlans: () => void;
  onBack: () => void;
}

export function PlanResults({
  answers,
  things,
  pinned = [],
  initialShapeId = "coastal",
  initialOverrides = {},
  itineraries,
  myPlansOpen = false,
  onSave,
  onMyPlans,
  onBack,
}: PlanResultsProps) {
  const [selectedShapeId, setSelectedShapeId] = useState(initialShapeId);
  const [overrides, setOverrides] = useState<Partial<Record<Block, Stop>>>(initialOverrides);
  const [swapBlock, setSwapBlock] = useState<Block | null>(null);
  const [savedToast, setSavedToast] = useState(false);
  const [shareState, setShareState] = useState<
    "idle" | "pending" | "shared" | "copied" | "failed"
  >("idle");

  const thingMap = useMemo(
    () => new Map(things.map((t) => [t.id, t])),
    [things],
  );

  const selectedShape = DAY_SHAPE_BY_ID[selectedShapeId] ?? PLAN_SELECTOR_SHAPES[0];

  const baseStops = useMemo(
    () => buildDay(answers, selectedShape, things, pinned),
    [answers, selectedShape, things, pinned],
  );

  const displayStops = useMemo(
    () => baseStops.map((s) => overrides[s.block] ?? s),
    [baseStops, overrides],
  );

  const firstBlock = displayStops[0]?.block;
  const lastBlock = displayStops[displayStops.length - 1]?.block;
  const subline = [
    shortStamp(answers.dateISO),
    firstBlock && lastBlock && firstBlock !== lastBlock
      ? `${blockShortName(firstBlock)} → ${blockShortName(lastBlock)}`
      : firstBlock
        ? blockShortName(firstBlock)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const swapCandidates = useMemo(() => {
    if (!swapBlock) return [];
    return rankedCandidates(swapBlock, answers, selectedShape, things, displayStops);
  }, [swapBlock, answers, selectedShape, things, displayStops]);

  const currentSwapStopId =
    swapBlock != null
      ? (displayStops.find((s) => s.block === swapBlock)?.thingId ?? null)
      : null;

  function handleShapeChange(id: string) {
    setSelectedShapeId(id);
    setOverrides({});
  }

  function handleSwap(block: Block) {
    setSwapBlock(block);
  }

  function handleSwapSelect(thing: Thing, fromSaved: boolean) {
    if (!swapBlock) return;
    setOverrides((prev) => ({
      ...prev,
      [swapBlock]: { block: swapBlock, thingId: thing.id, pinned: false, fromSaved },
    }));
    setSwapBlock(null);
  }

  async function handleShare() {
    if (shareState === "pending" || displayStops.length === 0) return;
    setShareState("pending");
    const title = `${selectedShape.name} Day — ${shortStamp(answers.dateISO)}`;
    const payload = {
      title,
      dateISO: answers.dateISO,
      stops: displayStops.flatMap((s) => {
        const t = thingMap.get(s.thingId);
        if (!t) return [];
        const zone = t.nearby_zone ? planZoneLabel(t.nearby_zone) : "Santa Barbara";
        return [{
          block: s.block,
          timeLabel: BLOCK_TIME_LABEL[s.block],
          title: t.title,
          area: zone,
          blurb: t.reason_to_go ?? "",
          category: t.happening_category ?? t.type ?? "",
          thingId: t.id,
          photo_url: t.photo_url ?? null,
        }];
      }),
    };
    const token = await createSharedPlan(payload);
    if (!token) {
      setShareState("failed");
      setTimeout(() => setShareState("idle"), 2200);
      return;
    }
    const url = `${window.location.origin}/p/${token}`;
    const result = await shareUrl(url, title);
    setShareState(result === "shared" ? "shared" : result === "copied" ? "copied" : "failed");
    setTimeout(() => setShareState("idle"), 2200);
  }

  function handleSave() {
    onSave({
      title: `${selectedShape.name} Day`,
      shapeId: selectedShapeId,
      answers,
      stops: displayStops,
    });
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  }

  const alreadySaved = itineraries.some(
    (it) =>
      it.shapeId === selectedShapeId &&
      it.answers.dateISO === answers.dateISO &&
      it.stops.length === displayStops.length &&
      it.stops.every((s, i) => s.thingId === displayStops[i]?.thingId),
  );

  return (
    <>
      <header className="sbd-header sbd-plan-header">
        <div className="sbd-plan-header__left">
          <button
            type="button"
            className="sbd-plan-back"
            onClick={onBack}
            aria-label="Back to setup"
          >
            ‹
          </button>
          <div>
            <div className="sbd-header__name">Your SB Day</div>
            <div className="sbd-header__tag">Tap a stop to see details</div>
          </div>
        </div>
        <button
          type="button"
          className="sbd-myplans-btn"
          aria-label={`My plans${itineraries.length > 0 ? ` (${itineraries.length})` : ""}`}
          aria-expanded={myPlansOpen}
          onClick={onMyPlans}
        >
          <span aria-hidden="true">🗓</span>
          {itineraries.length > 0 ? (
            <span className="sbd-myplans-btn__count" aria-hidden="true">
              {itineraries.length}
            </span>
          ) : null}
          <span className="sbd-myplans-btn__chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      </header>

      <main id="main" className="sbd-shell__main">
        <p className="sbd-subline" aria-live="polite">
          {subline}
        </p>

        <DayShapeSelector
          shapes={PLAN_SELECTOR_SHAPES}
          value={selectedShapeId}
          onChange={handleShapeChange}
        />

        {selectedShape ? (
          <p className="sbd-daycap">{selectedShape.caption}</p>
        ) : null}

        {displayStops.length === 0 ? (
          <div style={{ padding: "0 var(--space-5)" }}>
            <EmptyState
              icon="🗺️"
              title="Nothing to work with yet"
              message="Our catalog is still being built out. Try a different date or day shape — or check back soon."
            />
          </div>
        ) : (
          <ItinerarySpine
            stops={displayStops}
            things={thingMap}
            onSwap={handleSwap}
          />
        )}

        <div style={{ height: "104px" }} />
      </main>

      <div className="sbd-plan-gobar">
        <button
          type="button"
          className="sbd-btn sbd-btn--primary sbd-plan-gobar__save"
          onClick={handleSave}
          disabled={displayStops.length === 0 || alreadySaved || savedToast}
        >
          {savedToast ? "✓ Saved!" : alreadySaved ? "✓ Already saved" : "💾 Save plan"}
        </button>
        <button
          type="button"
          className="sbd-btn sbd-btn--secondary"
          onClick={handleShare}
          disabled={shareState === "pending" || displayStops.length === 0}
        >
          {shareState === "pending"
            ? "Sharing…"
            : shareState === "shared"
              ? "✓ Shared!"
              : shareState === "copied"
                ? "✓ Link copied"
                : shareState === "failed"
                  ? "Share failed"
                  : "↗ Share"}
        </button>
      </div>

      {swapBlock != null ? (
        <SwapSheet
          block={swapBlock}
          currentStopId={currentSwapStopId}
          candidates={swapCandidates}
          onSelect={handleSwapSelect}
          onClose={() => setSwapBlock(null)}
        />
      ) : null}
    </>
  );
}
