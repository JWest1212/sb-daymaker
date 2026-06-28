"use client";

import { useState } from "react";
import { PlanSetup } from "./PlanSetup";
import { PlanResults } from "./PlanResults";
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

  function makeMyDay() {
    setAnswers(makeMyDayAnswers(todayISO()));
    setView("results");
  }

  function showDay(a: PlanAnswers) {
    setAnswers(a);
    setView("results");
  }

  function buildFromSaved() {
    // Wired to the build-from-saved picker in Phase 6.
  }

  if (view === "results" && answers) {
    return (
      <PlanResults
        answers={answers}
        things={things}
        onBack={() => setView("setup")}
      />
    );
  }

  return (
    <PlanSetup
      onMakeMyDay={makeMyDay}
      onShowDay={showDay}
      onBuildFromSaved={buildFromSaved}
    />
  );
}
