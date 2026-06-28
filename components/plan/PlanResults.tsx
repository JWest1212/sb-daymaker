"use client";

import { useMemo } from "react";
import { EmptyState } from "@/components/ui";
import { BLOCK_TIME_LABEL } from "@/lib/plan/buildDay";
import type { Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

// INTERIM results view (Phase 3). The real time-of-day spine + day-shape selector
// land in Phase 4 and replace this wholesale — for now it's a plain readable list
// so the setup → buildDay → results pipeline is verifiable end to end.

interface PlanResultsProps {
  stops: Stop[];
  things: Thing[];
  onBack: () => void;
}

export function PlanResults({ stops, things, onBack }: PlanResultsProps) {
  const byId = useMemo(() => new Map(things.map((t) => [t.id, t])), [things]);

  return (
    <>
      <header className="sbd-header sbd-plan-header">
        <button
          type="button"
          className="sbd-plan-back"
          onClick={onBack}
          aria-label="Back to setup"
        >
          ‹
        </button>
        <span className="sbd-plan-header__brand">
          <span className="sbd-header__name">Your SB Day</span>
          <span className="sbd-header__tag" style={{ display: "block" }}>
            Spine coming next phase
          </span>
        </span>
      </header>

      <main id="main" className="sbd-shell__main sbd-plan-setup">
        {stops.length === 0 ? (
          <EmptyState
            icon="🗺️"
            title="No day to show yet"
            message="No published spots are available to fill a day right now. Once content is connected, your day appears here."
          />
        ) : (
          <ol className="sbd-plan-interim">
            {stops.map((s) => {
              const thing = byId.get(s.thingId);
              return (
                <li key={s.block} className="sbd-plan-interim__row">
                  <span className="sbd-plan-interim__time">
                    {BLOCK_TIME_LABEL[s.block]}
                  </span>
                  <span className="sbd-plan-interim__title">
                    {thing?.title ?? s.thingId}
                    {s.fromSaved ? (
                      <span className="sbd-plan-interim__saved"> ♥ Saved</span>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </main>
    </>
  );
}
