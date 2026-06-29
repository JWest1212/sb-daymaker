"use client";

import { useMemo, useState } from "react";
import { ItinerarySpine } from "./ItinerarySpine";
import { AddStopSheet } from "./AddStopSheet";
import { SaveNameSheet } from "./SaveNameSheet";
import { shortStamp } from "@/lib/plan/dates";
import { blockShortName, planZoneLabel, BLOCK_LABEL } from "@/lib/plan/labels";
import type { ItineraryInput, SavedItinerary } from "@/lib/plan/itineraries";
import type { PlanAnswers, Block, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";
import { createSharedPlan } from "@/lib/shares";
import { shareUrl } from "@/components/saved/share";

// Auto-title per §9: "Your SB Day · Jun 28" or "{Area} Day · Jun 28"
function autoTitle(answers: PlanAnswers): string {
  const monthDay = new Date(answers.dateISO + "T12:00:00").toLocaleDateString(
    "en-US",
    { month: "short", day: "numeric" },
  );
  if (answers.zone) {
    return `${planZoneLabel(answers.zone)} Day · ${monthDay}`;
  }
  return `Your SB Day · ${monthDay}`;
}

function genStopId(): string {
  return Math.random().toString(36).slice(2, 9);
}

interface PlanResultsProps {
  answers: PlanAnswers;
  things: Thing[];
  initialStops?: Stop[];
  itineraries: SavedItinerary[];
  myPlansOpen?: boolean;
  onSave: (data: ItineraryInput) => string;
  onMyPlans: () => void;
  onBack: () => void;
}

export function PlanResults({
  answers,
  things,
  initialStops = [],
  itineraries,
  myPlansOpen = false,
  onSave,
  onMyPlans,
  onBack,
}: PlanResultsProps) {
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [pickerBlock, setPickerBlock] = useState<Block | null>(null);
  const [namingOpen, setNamingOpen] = useState(false);
  const [savedToast, setSavedToast] = useState(false);
  const [shareState, setShareState] = useState<
    "idle" | "pending" | "shared" | "copied" | "failed"
  >("idle");

  const thingMap = useMemo(
    () => new Map(things.map((t) => [t.id, t])),
    [things],
  );

  // Build subline from the selected periods range.
  const firstPeriod = answers.periods[0];
  const lastPeriod = answers.periods[answers.periods.length - 1];
  const subline = [
    shortStamp(answers.dateISO),
    firstPeriod && lastPeriod && firstPeriod !== lastPeriod
      ? `${blockShortName(firstPeriod)} → ${blockShortName(lastPeriod)}`
      : firstPeriod
        ? blockShortName(firstPeriod)
        : null,
  ]
    .filter(Boolean)
    .join(" · ");

  function addStop(block: Block, thing: Thing, fromSaved: boolean) {
    const newStop: Stop = {
      id: genStopId(),
      block,
      thingId: thing.id,
      fromSaved,
    };
    setStops((prev) => [...prev, newStop]);
    setPickerBlock(null);
  }

  function removeStop(stopId: string) {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }

  async function handleShare() {
    if (shareState === "pending" || stops.length === 0) return;
    setShareState("pending");
    const title = autoTitle(answers);
    const payload = {
      title,
      dateISO: answers.dateISO,
      stops: stops.flatMap((s) => {
        const t = thingMap.get(s.thingId);
        if (!t) return [];
        const area = t.nearby_zone ? planZoneLabel(t.nearby_zone) : "Santa Barbara";
        return [{
          block: s.block,
          blockLabel: BLOCK_LABEL[s.block],
          startsAt: t.starts_at ?? null,
          title: t.title,
          area,
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
    setNamingOpen(true);
  }

  function confirmSave(title: string) {
    onSave({ title, answers, stops });
    setNamingOpen(false);
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2200);
  }

  const hasStops = stops.length > 0;

  const alreadySaved = itineraries.some(
    (it) =>
      it.answers.dateISO === answers.dateISO &&
      it.stops.length === stops.length &&
      it.stops.every((s, i) => s.thingId === stops[i]?.thingId),
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
          My plans{itineraries.length > 0 ? ` · ${itineraries.length}` : ""}
          <span className="sbd-myplans-btn__chevron" aria-hidden="true">
            ▾
          </span>
        </button>
      </header>

      <main id="main" className="sbd-shell__main">
        <p className="sbd-subline" aria-live="polite">
          {subline}
        </p>

        <ItinerarySpine
          sections={answers.periods}
          stops={stops}
          things={thingMap}
          onAddStop={(block) => setPickerBlock(block)}
          onRemoveStop={removeStop}
        />

        <div style={{ height: "104px" }} />
      </main>

      <div className="sbd-plan-gobar">
        <button
          type="button"
          className="sbd-btn sbd-btn--primary sbd-plan-gobar__save"
          onClick={handleSave}
          disabled={!hasStops || alreadySaved || savedToast}
        >
          {savedToast ? "✓ Saved!" : alreadySaved ? "✓ Already saved" : "💾 Save plan"}
        </button>
        <button
          type="button"
          className="sbd-btn sbd-btn--secondary"
          onClick={handleShare}
          disabled={shareState === "pending" || !hasStops}
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

      {pickerBlock != null ? (
        <AddStopSheet
          block={pickerBlock}
          answers={answers}
          things={things}
          onAdd={(thing, fromSaved) => addStop(pickerBlock, thing, fromSaved)}
          onClose={() => setPickerBlock(null)}
        />
      ) : null}

      {namingOpen ? (
        <SaveNameSheet
          defaultTitle={autoTitle(answers)}
          onSave={confirmSave}
          onClose={() => setNamingOpen(false)}
        />
      ) : null}
    </>
  );
}
