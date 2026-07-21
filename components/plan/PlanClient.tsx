"use client";

import { useEffect, useRef, useState } from "react";
import { PlanSetup, type ShowDayOptions } from "./PlanSetup";
import { PlanResults } from "./PlanResults";
import type { PlanAnswers } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

// The "Solving your day..." beat sells the validated-day promise. Purely
// cosmetic (the engine is instant); skipped under prefers-reduced-motion.
const SOLVE_STEPS = [
  "Checking what's open",
  "Clustering by neighborhood",
  "Placing your stops",
  "Adding parking and a lunch stop",
  "Validating the day",
];

function BuildingScreen() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % SOLVE_STEPS.length), 460);
    return () => clearInterval(t);
  }, []);
  return (
    <main id="main" className="sbd-shell__main sbd-wizbuild" aria-live="polite">
      <div className="sbd-wizbuild__spinner" aria-hidden="true" />
      <p className="sbd-wizbuild__title">Solving your day…</p>
      <p className="sbd-wizbuild__step">{SOLVE_STEPS[i]}</p>
    </main>
  );
}

export function PlanClient({ things }: { things: Thing[] }) {
  const [view, setView] = useState<"setup" | "building" | "results">("setup");
  const [answers, setAnswers] = useState<PlanAnswers | null>(null);
  const [blank, setBlank] = useState(false);
  const [planKey, setPlanKey] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function showDay(a: PlanAnswers, opts?: ShowDayOptions) {
    const isBlank = opts?.blank ?? false;
    setAnswers(a);
    setBlank(isBlank);
    setPlanKey((k) => k + 1);

    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    // A blank day has nothing to "solve"; skip straight to the empty spine.
    if (isBlank || reduced) {
      setView("results");
      return;
    }
    setView("building");
    timer.current = setTimeout(() => setView("results"), 1350);
  }

  function handleBack() {
    if (timer.current) clearTimeout(timer.current);
    setView("setup");
  }

  if (view === "building") return <BuildingScreen />;

  if (view === "results" && answers) {
    return (
      <PlanResults
        key={planKey}
        answers={answers}
        things={things}
        blank={blank}
        onBack={handleBack}
      />
    );
  }

  return <PlanSetup onShowDay={showDay} />;
}
