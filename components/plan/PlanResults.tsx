"use client";

import { useEffect, useMemo, useState } from "react";
import { ItinerarySpine } from "./ItinerarySpine";
import { AddStopSheet } from "./AddStopSheet";
import { shortStamp } from "@/lib/plan/dates";
import { planZoneLabel, BLOCK_LABEL } from "@/lib/plan/labels";
import { buildConciergeDay, nextBestAlternate } from "@/lib/plan/buildConciergeDay";
import { annotateTransitions } from "@/lib/plan/transitions";
import { isFood } from "@/lib/plan/meals";
import {
  resolveParams,
  whoLabel,
  transportLabel,
  budgetLabel,
  mealsLabel,
} from "@/lib/plan/params";
import { useSaves } from "@/components/saves/SavesProvider";
import type { PlanAnswers, Block, Stop, PlanNote } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";
import { createSharedPlan } from "@/lib/shares";
import { shareUrl } from "@/components/saved/share";
import { trackEvent } from "@/lib/analytics";

function genStopId(): string {
  return Math.random().toString(36).slice(2, 9);
}

// Auto-title: "Your SB Day · Jun 28" or "{Area} Day · Jun 28"
function autoTitle(answers: PlanAnswers): string {
  const monthDay = new Date(answers.dateISO + "T12:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  if (answers.zone) return `${planZoneLabel(answers.zone)} Day · ${monthDay}`;
  return `Your SB Day · ${monthDay}`;
}

interface PlanResultsProps {
  answers: PlanAnswers;
  things: Thing[];
  /** Start with an empty spine (the "blank day" express path); the user adds
   *  stops manually. Regenerate still fills it with a validated draft. */
  blank?: boolean;
  onBack: () => void;
}

export function PlanResults({ answers, things, blank = false, onBack }: PlanResultsProps) {
  const { state } = useSaves();
  const savedStateFor = useMemo(
    () => (id: string) => (state(id) as "want" | "been" | null) ?? null,
    [state],
  );

  const thingMap = useMemo(() => new Map(things.map((t) => [t.id, t])), [things]);
  const params = useMemo(() => resolveParams(answers), [answers]);

  // Build the concierge draft once on mount (unless this is a blank day); keep
  // its honest notes. A new plan remounts via PlanClient's key, so this never
  // clobbers edits.
  const initial = useMemo(
    () => (blank ? { stops: [], notes: [] } : buildConciergeDay(answers, things, savedStateFor)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [stops, setStops] = useState<Stop[]>(initial.stops);
  const [notes, setNotes] = useState<PlanNote[]>(initial.notes);

  const [pickerBlock, setPickerBlock] = useState<Block | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [didRegen, setDidRegen] = useState(false);
  const [shareState, setShareState] = useState<
    "idle" | "pending" | "shared" | "copied" | "failed"
  >("idle");

  // Event 6: the draft spine is first produced from the questionnaire.
  useEffect(() => {
    trackEvent("plan_built", { stops: stops.length });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // fire once on mount; stops.length at mount is the built draft size

  // Transitions are recomputed from the current stop order (pure).
  const transitions = useMemo(
    () => annotateTransitions(stops, thingMap, params),
    [stops, thingMap, params],
  );
  const transitionByStop = useMemo(
    () => new Map(transitions.map((t) => [t.beforeStopId, t])),
    [transitions],
  );

  // Subline from the resolved params date.
  const subline = shortStamp(answers.dateISO);

  // Params chips (shared with the OG/share payload).
  const paramChips = useMemo(() => {
    return [
      shortStamp(answers.dateISO),
      whoLabel(params),
      transportLabel(answers.transport),
      budgetLabel(answers.budget),
      mealsLabel(params.meals),
    ].filter(Boolean) as string[];
  }, [answers, params]);

  function addStop(block: Block, thing: Thing, fromSaved: boolean) {
    const newStop: Stop = {
      id: genStopId(),
      block,
      thingId: thing.id,
      fromSaved,
      fromDraft: false, // user-added, no Suggested chip
    };
    setStops((prev) => [...prev, newStop]);
    setPickerBlock(null);
  }

  function removeStop(stopId: string) {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }

  // G4.4, tap-to-swap: replace a stop with the next-best eligible alternate.
  // Re-runs the hard filter, so a swap can never introduce a violation. A meal
  // stop swaps to the next-best food; an activity to the next-best activity.
  function swapStop(stopId: string) {
    setStops((prev) => {
      const idx = prev.findIndex((s) => s.id === stopId);
      if (idx < 0) return prev;
      const stop = prev[idx];
      const exclude = new Set(prev.map((s) => s.thingId));
      const pool = stop.meal ? things.filter(isFood) : things;
      const alt = nextBestAlternate(answers, stop.block, pool, savedStateFor, exclude);
      if (!alt) return prev;
      const next = [...prev];
      next[idx] = { ...stop, thingId: alt.id, fromSaved: savedStateFor(alt.id) !== null };
      return next;
    });
  }

  function handleRegenerate() {
    // Keep user-added stops; replace only fromDraft ones with fresh picks.
    const userStops = stops.filter((s) => !s.fromDraft);
    const alreadyPlaced = new Set(userStops.map((s) => s.thingId));
    const fresh = buildConciergeDay(answers, things, savedStateFor, { alreadyPlaced });
    setStops([...userStops, ...fresh.stops]);
    setNotes(fresh.notes);
    setDidRegen(true);
  }

  function handleClear() {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    setStops([]);
    setNotes([]);
    setClearConfirm(false);
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
        const tr = transitionByStop.get(s.id);
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
          meal: s.meal ?? null,
          transition: tr ? { label: tr.label, parkingNote: tr.parkingNote } : null,
        }];
      }),
      params: {
        when: shortStamp(answers.dateISO),
        who: whoLabel(params),
        transport: transportLabel(answers.transport),
        budget: budgetLabel(answers.budget),
        meals: mealsLabel(params.meals),
      },
    };
    const token = await createSharedPlan(payload);
    if (!token) {
      setShareState("failed");
      setTimeout(() => setShareState("idle"), 2200);
      return;
    }
    // Event 3: a shared plan link was created (token never sent to analytics).
    trackEvent("share_create", { kind: "plan", count: stops.length });
    const url = `${window.location.origin}/p/${token}`;
    const result = await shareUrl(url, title);
    setShareState(result === "shared" ? "shared" : result === "copied" ? "copied" : "failed");
    setTimeout(() => setShareState("idle"), 2200);
  }

  const hasStops = stops.length > 0;
  const shareLabel =
    shareState === "pending" ? "Sharing…"
    : shareState === "shared" ? "✓ Shared!"
    : shareState === "copied" ? "✓ Link copied"
    : shareState === "failed" ? "Share failed"
    : "↗ Share day";

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
            <div className="sbd-header__name">Your draft, editable</div>
            <div className="sbd-header__tag">Open when it says, clustered, parked, fed</div>
          </div>
        </div>
      </header>

      <main id="main" className="sbd-shell__main">
        <p className="sbd-subline" aria-live="polite">{subline}</p>

        {paramChips.length > 0 ? (
          <div className="sbd-plan-params" aria-label="Your plan settings">
            {paramChips.map((c, i) => (
              <span key={i} className="sbd-ptag">{c}</span>
            ))}
          </div>
        ) : null}

        {notes.length > 0 ? (
          <ul className="sbd-plan-notes" aria-label="Notes about your plan">
            {notes.map((n, i) => (
              <li key={i} className="sbd-plan-note">{n.text}</li>
            ))}
          </ul>
        ) : null}

        <ItinerarySpine
          sections={answers.periods}
          stops={stops}
          things={thingMap}
          transitions={transitionByStop}
          onAddStop={(block) => setPickerBlock(block)}
          onRemoveStop={removeStop}
          onSwapStop={swapStop}
        />

        <div style={{ height: "120px" }} />
      </main>

      {/* Go-bar: three equal Pacific pills, Share solid (concierge prototype). */}
      <div className="sbd-plan-gobar sbd-plan-gobar--tri">
        <button
          type="button"
          className={`sbd-gb${clearConfirm ? " sbd-gb--warn" : ""}`}
          onClick={handleClear}
          disabled={!hasStops}
        >
          {clearConfirm ? "Tap again" : "Clear"}
        </button>
        <button
          type="button"
          className="sbd-gb"
          onClick={handleRegenerate}
          aria-label="Redo: fresh draft, same rules"
        >
          ↺ Redo
        </button>
        <button
          type="button"
          className="sbd-gb sbd-gb--share"
          onClick={handleShare}
          disabled={shareState === "pending" || !hasStops}
        >
          {shareLabel}
        </button>
      </div>
      {didRegen ? (
        <p className="sbd-regennote" aria-live="polite">
          Fresh draft, same rules, different picks
        </p>
      ) : null}

      {pickerBlock != null ? (
        <AddStopSheet
          block={pickerBlock}
          answers={answers}
          things={things}
          onAdd={(thing, fromSaved) => addStop(pickerBlock, thing, fromSaved)}
          onClose={() => setPickerBlock(null)}
        />
      ) : null}
    </>
  );
}
