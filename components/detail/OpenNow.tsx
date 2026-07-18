"use client";

// Elevation v1 · Gate 1 · G1.5, the "open now" line on a detail page.
// Computed CLIENT-SIDE from the stored `hours` against Santa Barbara local time,
// so there's no per-request API call (CLAUDE.md §2 determinism / cost floor) and
// no server/client hydration skew from a server clock. Renders nothing when hours
// are unknown (never a guessed state).

import { useEffect, useState } from "react";
import { openStateAt, sbNowParts, type HourSpec, type OpenNow as OpenNowResult } from "@/lib/format/openNow";

export function OpenNow({ hours }: { hours: HourSpec[] | null }) {
  // Resolve after mount so the string reflects the viewer's real "now" (the page
  // is ISR-cached, so a server-computed value would be stale). Until then, render
  // nothing to avoid a hydration mismatch.
  const [state, setState] = useState<OpenNowResult | null>(null);
  useEffect(() => {
    setState(openStateAt(hours, sbNowParts(Date.now())));
  }, [hours]);

  if (!state || state.state === "unknown" || !state.label) return null;

  return (
    <p className={`sbd-detail__hours sbd-detail__hours--${state.state}`}>
      <span className="sbd-detail__hours-dot" aria-hidden="true" />
      {state.label}
    </p>
  );
}
