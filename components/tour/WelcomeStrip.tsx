"use client";

import { useTour } from "./useTour";
import { HOW_IT_WORKS } from "@/lib/strings";
import { SBIcon } from "@/components/ui/SBIcon";

/**
 * R1 W8.3 (D8). The first-visit welcome: one line above the pick, over the real
 * page, closable. It replaces the blocking modal. Closing it is what records
 * that the visitor has been welcomed (TourProvider.dismissStrip).
 */
export function WelcomeStrip() {
  const { showStrip, dismissStrip, openTour } = useTour();
  if (!showStrip) return null;
  return (
    <aside className="sbd-welcome" aria-label="Welcome">
      <p className="sbd-welcome__text">
        New here? Tap a heart to save it. Mark what you did.{" "}
        <button type="button" className="sbd-welcome__how" aria-haspopup="dialog" onClick={openTour}>
          {HOW_IT_WORKS}
        </button>
        .
      </p>
      <button type="button" className="sbd-welcome__close" aria-label="Dismiss the welcome" onClick={dismissStrip}>
        <SBIcon name="close" size={18} strokeWidth={2} />
      </button>
    </aside>
  );
}
