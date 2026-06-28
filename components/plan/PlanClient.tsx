"use client";

import { useState } from "react";
import { PlanSetup } from "./PlanSetup";
import { PlanResults } from "./PlanResults";
import { buildDay, makeMyDayAnswers, DEFAULT_DAY_SHAPE } from "@/lib/plan/buildDay";
import { todayISO } from "@/lib/plan/dates";
import type { PlanAnswers, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

/**
 * Root of the Plan surface — a small state machine between the setup screen and
 * the day results. Phase 3 ships setup + an interim results list; Phase 4 swaps
 * the results for the time-of-day spine + day-shape selector.
 */
export function PlanClient({ things }: { things: Thing[] }) {
  const [view, setView] = useState<"setup" | "results">("setup");
  const [stops, setStops] = useState<Stop[]>([]);

  function makeMyDay() {
    setStops(buildDay(makeMyDayAnswers(todayISO()), DEFAULT_DAY_SHAPE, things));
    setView("results");
  }

  function showDay(answers: PlanAnswers) {
    setStops(buildDay(answers, DEFAULT_DAY_SHAPE, things));
    setView("results");
  }

  function buildFromSaved() {
    // Wired to the build-from-saved picker in Phase 6.
  }

  if (view === "results") {
    return (
      <PlanResults stops={stops} things={things} onBack={() => setView("setup")} />
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
