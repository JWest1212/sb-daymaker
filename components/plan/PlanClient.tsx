"use client";

import { useEffect, useState } from "react";
import { PlanSetup } from "./PlanSetup";
import { PlanResults } from "./PlanResults";
import { MyPlansDrawer } from "./MyPlansDrawer";
import { useItineraries, type SavedItinerary } from "@/lib/plan/itineraries";
import type { PlanAnswers, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

export function PlanClient({ things }: { things: Thing[] }) {
  const [view, setView] = useState<"setup" | "results">("setup");
  const [answers, setAnswers] = useState<PlanAnswers | null>(null);
  const [initialStops, setInitialStops] = useState<Stop[]>([]);
  const [planKey, setPlanKey] = useState(0);
  const [myPlansOpen, setMyPlansOpen] = useState(false);

  const { itineraries, save, remove } = useItineraries();

  // On mount: check sessionStorage for a plan opened from Saved › Days.
  useEffect(() => {
    const raw = sessionStorage.getItem("sbd.open-plan");
    if (!raw) return;
    sessionStorage.removeItem("sbd.open-plan");
    try {
      const plan = JSON.parse(raw) as SavedItinerary;
      loadItinerary(plan);
    } catch {
      /* ignore corrupt data */
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function loadItinerary(plan: SavedItinerary) {
    // Ensure each stop has an id (migration-safety for old stored plans).
    const stops: Stop[] = plan.stops.map((s) => ({
      ...s,
      id: s.id || Math.random().toString(36).slice(2, 9),
    }));
    setAnswers(plan.answers);
    setInitialStops(stops);
    setPlanKey((k) => k + 1);
    setView("results");
    setMyPlansOpen(false);
  }

  function showDay(a: PlanAnswers) {
    setAnswers(a);
    setInitialStops([]);
    setPlanKey((k) => k + 1);
    setView("results");
  }

  function handleBack() {
    setInitialStops([]);
    setView("setup");
  }

  if (view === "results" && answers) {
    return (
      <>
        <PlanResults
          key={planKey}
          answers={answers}
          things={things}
          initialStops={initialStops}
          itineraries={itineraries}
          myPlansOpen={myPlansOpen}
          onSave={save}
          onMyPlans={() => setMyPlansOpen(true)}
          onBack={handleBack}
        />
        <MyPlansDrawer
          open={myPlansOpen}
          onClose={() => setMyPlansOpen(false)}
          itineraries={itineraries}
          onOpen={loadItinerary}
          onRemove={remove}
        />
      </>
    );
  }

  return (
    <>
      <PlanSetup
        onShowDay={showDay}
        itineraryCount={itineraries.length}
        onMyPlans={() => setMyPlansOpen(true)}
      />
      <MyPlansDrawer
        open={myPlansOpen}
        onClose={() => setMyPlansOpen(false)}
        itineraries={itineraries}
        onOpen={loadItinerary}
        onRemove={remove}
      />
    </>
  );
}
