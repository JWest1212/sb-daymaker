"use client";

import { useEffect, useState } from "react";
import { PlanSetup } from "./PlanSetup";
import { PlanResults } from "./PlanResults";
import { PinPickerSheet } from "./PinPickerSheet";
import { MyPlansDrawer } from "./MyPlansDrawer";
import { makeMyDayAnswers } from "@/lib/plan/buildDay";
import { todayISO } from "@/lib/plan/dates";
import { useItineraries, type SavedItinerary } from "@/lib/plan/itineraries";
import type { PlanAnswers, Block, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

export function PlanClient({ things }: { things: Thing[] }) {
  const [view, setView] = useState<"setup" | "results">("setup");
  const [answers, setAnswers] = useState<PlanAnswers | null>(null);
  const [shapeId, setShapeId] = useState("coastal");
  const [initialOverrides, setInitialOverrides] = useState<Partial<Record<Block, Stop>>>({});
  const [planKey, setPlanKey] = useState(0);
  const [pinned, setPinned] = useState<Thing[]>([]);
  const [pinPickerOpen, setPinPickerOpen] = useState(false);
  const [pendingAnswers, setPendingAnswers] = useState<PlanAnswers | null>(null);
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
    const overrides = Object.fromEntries(
      plan.stops.map((s) => [s.block, s]),
    ) as Partial<Record<Block, Stop>>;
    setAnswers(plan.answers);
    setShapeId(plan.shapeId);
    setInitialOverrides(overrides);
    setPinned([]);
    setPlanKey((k) => k + 1);
    setView("results");
    setMyPlansOpen(false);
  }

  function makeMyDay() {
    setPinned([]);
    setInitialOverrides({});
    setShapeId("coastal");
    setAnswers(makeMyDayAnswers(todayISO()));
    setPlanKey((k) => k + 1);
    setView("results");
  }

  function showDay(a: PlanAnswers) {
    setPinned([]);
    setInitialOverrides({});
    setShapeId("coastal");
    setAnswers(a);
    setPlanKey((k) => k + 1);
    setView("results");
  }

  function openPinPicker(a: PlanAnswers) {
    setPendingAnswers(a);
    setPinPickerOpen(true);
  }

  function handleBuildWithPins(pins: Thing[]) {
    if (!pendingAnswers) return;
    setPinned(pins);
    setInitialOverrides({});
    setShapeId("coastal");
    setAnswers(pendingAnswers);
    setPendingAnswers(null);
    setPinPickerOpen(false);
    setPlanKey((k) => k + 1);
    setView("results");
  }

  function handleBack() {
    setPinned([]);
    setInitialOverrides({});
    setView("setup");
  }

  if (view === "results" && answers) {
    return (
      <>
        <PlanResults
          key={planKey}
          answers={answers}
          things={things}
          pinned={pinned}
          initialShapeId={shapeId}
          initialOverrides={initialOverrides}
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
        onMakeMyDay={makeMyDay}
        onShowDay={showDay}
        onBuildFromSaved={openPinPicker}
        itineraryCount={itineraries.length}
        onMyPlans={() => setMyPlansOpen(true)}
      />
      {pinPickerOpen ? (
        <PinPickerSheet
          things={things}
          onBuild={handleBuildWithPins}
          onClose={() => {
            setPinPickerOpen(false);
            setPendingAnswers(null);
          }}
        />
      ) : null}
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
