"use client";

import { useMemo, useState } from "react";
import { EmptyState } from "@/components/ui";
import { DayShapeSelector } from "./DayShapeSelector";
import { ItinerarySpine } from "./ItinerarySpine";
import { buildDay } from "@/lib/plan/buildDay";
import { shortStamp } from "@/lib/plan/dates";
import { PLAN_SELECTOR_SHAPES, DAY_SHAPE_BY_ID } from "@/lib/plan/dayShapes";
import { blockShortName } from "@/lib/plan/labels";
import type { PlanAnswers, Block } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

interface PlanResultsProps {
  answers: PlanAnswers;
  things: Thing[];
  onBack: () => void;
}

export function PlanResults({ answers, things, onBack }: PlanResultsProps) {
  const [selectedShapeId, setSelectedShapeId] = useState("coastal");

  const thingMap = useMemo(
    () => new Map(things.map((t) => [t.id, t])),
    [things],
  );

  const stops = useMemo(() => {
    const shape = DAY_SHAPE_BY_ID[selectedShapeId] ?? PLAN_SELECTOR_SHAPES[0];
    return buildDay(answers, shape, things, []);
  }, [answers, selectedShapeId, things]);

  const selectedShape = DAY_SHAPE_BY_ID[selectedShapeId];

  const firstBlock = stops[0]?.block;
  const lastBlock = stops[stops.length - 1]?.block;
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

  function handleSwap(_block: Block) {
    // Phase 5 wires the swap sheet
  }

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
          aria-label="My plans (coming soon)"
          aria-expanded={false}
          disabled
        >
          <span aria-hidden="true">🗓</span>
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
          onChange={setSelectedShapeId}
        />

        {selectedShape ? (
          <p className="sbd-daycap">{selectedShape.caption}</p>
        ) : null}

        {stops.length === 0 ? (
          <div style={{ padding: "0 var(--space-5)" }}>
            <EmptyState
              icon="🗺️"
              title="No day to build yet"
              message="No published spots are available right now. Once content is connected, your day appears here."
            />
          </div>
        ) : (
          <ItinerarySpine
            stops={stops}
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
          disabled
        >
          💾 Save plan
        </button>
        <button
          type="button"
          className="sbd-btn sbd-btn--secondary"
          disabled
        >
          ↗ Share
        </button>
      </div>
    </>
  );
}
