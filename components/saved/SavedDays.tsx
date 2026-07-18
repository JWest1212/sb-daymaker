"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { EmptyState } from "@/components/ui";
import { shortStamp } from "@/lib/plan/dates";
import {
  useItineraries,
  BLOCK_DOT_COLOR,
  type SavedItinerary,
} from "@/lib/plan/itineraries";

export function SavedDays() {
  const router = useRouter();
  const { itineraries, remove } = useItineraries();
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleOpen(plan: SavedItinerary) {
    sessionStorage.setItem("sbd.open-plan", JSON.stringify(plan));
    router.push("/plan");
  }

  function handleDelete(id: string) {
    if (confirmId === id) {
      remove(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
    }
  }

  if (itineraries.length === 0) {
    return (
      <EmptyState
        icon="🗓"
        title="No saved days yet"
        message="Build a day on the Plan tab and tap Save plan, it'll live here."
      />
    );
  }

  return (
    <div className="sbd-days">
      {itineraries.map((plan) => (
        <div key={plan.id} className="sbd-dayrow">
          <button
            type="button"
            className="sbd-dayrow__body"
            onClick={() => handleOpen(plan)}
            aria-label={`Open ${plan.title}`}
          >
            <div className="sbd-dayrow__dots" aria-hidden="true">
              {plan.stops.map((s) => (
                <span
                  key={s.block}
                  className="sbd-dayrow__dot"
                  style={{ background: BLOCK_DOT_COLOR[s.block] }}
                />
              ))}
            </div>
            <span className="sbd-dayrow__title">{plan.title}</span>
            <span className="sbd-dayrow__meta">
              {shortStamp(plan.answers.dateISO)} · {plan.stops.length} stop{plan.stops.length !== 1 ? "s" : ""}
            </span>
          </button>
          <button
            type="button"
            className={`sbd-dayrow__del${confirmId === plan.id ? " sbd-dayrow__del--confirm" : ""}`}
            onClick={() => handleDelete(plan.id)}
            aria-label={confirmId === plan.id ? "Confirm delete" : `Delete ${plan.title}`}
          >
            {confirmId === plan.id ? "✕" : "🗑"}
          </button>
        </div>
      ))}
    </div>
  );
}
