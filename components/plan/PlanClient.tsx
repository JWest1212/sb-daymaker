"use client";

import { useState } from "react";
import { PlanSetup } from "./PlanSetup";
import { PlanResults } from "./PlanResults";
import { PinPickerSheet } from "./PinPickerSheet";
import { makeMyDayAnswers } from "@/lib/plan/buildDay";
import { todayISO } from "@/lib/plan/dates";
import type { PlanAnswers } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

/**
 * Root of the Plan surface — a small state machine between the setup screen
 * and the day results. Passes answers (not pre-built stops) to PlanResults so
 * the day-shape selector can re-run buildDay on pill switch without a round-trip.
 */
export function PlanClient({ things }: { things: Thing[] }) {
  const [view, setView] = useState<"setup" | "results">("setup");
  const [answers, setAnswers] = useState<PlanAnswers | null>(null);
  const [pinned, setPinned] = useState<Thing[]>([]);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<PlanAnswers | null>(null);

  function makeMyDay() {
    setPinned([]);
    setAnswers(makeMyDayAnswers(todayISO()));
    setView("results");
  }

  function showDay(a: PlanAnswers) {
    setPinned([]);
    setAnswers(a);
    setView("results");
  }

  function openPinPicker(a: PlanAnswers) {
    setPendingAnswers(a);
    setPinPickerOpen(true);
  }

  function handleBuildWithPins(pins: Thing[]) {
    if (!pendingAnswers) return;
    setPinned(pins);
    setAnswers(pendingAnswers);
    setPendingAnswers(null);
    setPinPickerOpen(false);
    setView("results");
  }

  function closePinPicker() {
    setPinPickerOpen(false);
    setPendingAnswers(null);
  }

  function handleBack() {
    setPinned([]);
    setView("setup");
  }

  if (view === "results" && answers) {
    return (
      <PlanResults
        answers={answers}
        things={things}
        pinned={pinned}
        onBack={handleBack}
      />
    );
  }

  return (
    <>
      <PlanSetup
        onMakeMyDay={makeMyDay}
        onShowDay={showDay}
        onBuildFromSaved={openPinPicker}
      />
      {pinPickerOpen ? (
        <PinPickerSheet
          things={things}
          onBuild={handleBuildWithPins}
          onClose={closePinPicker}
        />
      ) : null}
    </>
  );
}
