"use client";

import { useState } from "react";
import { PlanSetup } from "./PlanSetup";
import { PlanResults } from "./PlanResults";
import { buildDraft } from "@/lib/plan/buildDraft";
import { useSaves } from "@/components/saves/SavesProvider";
import type { PlanAnswers, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

export function PlanClient({ things }: { things: Thing[] }) {
  const [view, setView] = useState<"setup" | "results">("setup");
  const [answers, setAnswers] = useState<PlanAnswers | null>(null);
  const [initialStops, setInitialStops] = useState<Stop[]>([]);
  const [planKey, setPlanKey] = useState(0);

  const { state } = useSaves();

  function showDay(a: PlanAnswers) {
    const draft = buildDraft(a, things, (id) => (state(id) as "want" | "been" | null) ?? null);
    setAnswers(a);
    setInitialStops(draft);
    setPlanKey((k) => k + 1);
    setView("results");
  }

  function handleBack() {
    setInitialStops([]);
    setView("setup");
  }

  if (view === "results" && answers) {
    return (
      <PlanResults
        key={planKey}
        answers={answers}
        things={things}
        initialStops={initialStops}
        onBack={handleBack}
      />
    );
  }

  return <PlanSetup onShowDay={showDay} />;
}
