"use client";

import { PlanHeader } from "./PlanHeader";

/**
 * Root of the Plan surface. Phase 1: header + an empty body. Later phases fill the
 * body with the setup screen (Make My Day + five questions), the itinerary spine,
 * and the swap/build sheets.
 */
export function PlanClient() {
  return (
    <>
      <PlanHeader />
      <main id="main" className="sbd-shell__main" />
    </>
  );
}
