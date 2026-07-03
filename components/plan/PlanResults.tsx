"use client";

import { useMemo, useState } from "react";
import { ItinerarySpine } from "./ItinerarySpine";
import { AddStopSheet } from "./AddStopSheet";
import { shortStamp } from "@/lib/plan/dates";
import { blockShortName, planZoneLabel, BLOCK_LABEL } from "@/lib/plan/labels";
import { buildDraft } from "@/lib/plan/buildDraft";
import { useSaves } from "@/components/saves/SavesProvider";
import type { PlanAnswers, Block, Stop } from "@/lib/plan/types";
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
  initialStops?: Stop[];
  onBack: () => void;
}

export function PlanResults({
  answers,
  things,
  initialStops = [],
  onBack,
}: PlanResultsProps) {
  const [stops, setStops] = useState<Stop[]>(initialStops);
  const [pickerBlock, setPickerBlock] = useState<Block | null>(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [shareState, setShareState] = useState<
    "idle" | "pending" | "shared" | "copied" | "failed"
  >("idle");

  const { state } = useSaves();

  const thingMap = useMemo(
    () => new Map(things.map((t) => [t.id, t])),
    [things],
  );

  // Subline from selected periods range.
  const firstPeriod = answers.periods[0];
  const lastPeriod  = answers.periods[answers.periods.length - 1];
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
      fromDraft: false,  // user-added — no Suggested chip
    };
    setStops((prev) => [...prev, newStop]);
    setPickerBlock(null);
  }

  function removeStop(stopId: string) {
    setStops((prev) => prev.filter((s) => s.id !== stopId));
  }

  function handleRegenerate() {
    // Keep user-added stops; replace only fromDraft ones with fresh picks.
    const userStops = stops.filter((s) => !s.fromDraft);
    const alreadyPlaced = new Set(userStops.map((s) => s.thingId));
    const freshDraft = buildDraft(answers, things, (id) => (state(id) as "want" | "been" | null) ?? null, alreadyPlaced);
    setStops([...userStops, ...freshDraft]);
  }

  function handleClear() {
    if (!clearConfirm) {
      setClearConfirm(true);
      setTimeout(() => setClearConfirm(false), 3000);
      return;
    }
    setStops([]);
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
    // Event 3: a shared plan link was created (token never sent to analytics).
    trackEvent("share_create", { kind: "plan", count: stops.length });
    const url = `${window.location.origin}/p/${token}`;
    const result = await shareUrl(url, title);
    setShareState(result === "shared" ? "shared" : result === "copied" ? "copied" : "failed");
    setTimeout(() => setShareState("idle"), 2200);
  }

  const hasStops = stops.length > 0;
  const hasDraftStops = stops.some((s) => s.fromDraft);

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
            <div className="sbd-header__tag">Tap + to add stops</div>
          </div>
        </div>
        {hasDraftStops ? (
          <button
            type="button"
            className="sbd-regen-btn"
            onClick={handleRegenerate}
            aria-label="Regenerate suggested stops"
          >
            ↺ Regenerate
          </button>
        ) : null}
      </header>

      <main id="main" className="sbd-shell__main">
        <p className="sbd-subline" aria-live="polite">{subline}</p>

        <ItinerarySpine
          sections={answers.periods}
          stops={stops}
          things={thingMap}
          onAddStop={(block) => setPickerBlock(block)}
          onRemoveStop={removeStop}
        />

        <div style={{ height: "104px" }} />
      </main>

      {/* Bottom bar: Share + Clear (ephemeral — no Save) */}
      <div className="sbd-plan-gobar">
        <button
          type="button"
          className="sbd-btn sbd-btn--primary sbd-plan-gobar__share"
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
                  : "↗ Share day"}
        </button>
        <button
          type="button"
          className={`sbd-btn sbd-btn--ghost sbd-plan-gobar__clear${clearConfirm ? " sbd-btn--warn" : ""}`}
          onClick={handleClear}
        >
          {clearConfirm ? "Tap again to clear" : "✕ Clear"}
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
    </>
  );
}
