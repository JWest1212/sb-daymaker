"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui";
import { shortStamp } from "@/lib/plan/dates";
import { BLOCK_DOT_COLOR, type SavedItinerary } from "@/lib/plan/itineraries";

interface MyPlansDrawerProps {
  open: boolean;
  onClose: () => void;
  itineraries: SavedItinerary[];
  onOpen: (plan: SavedItinerary) => void;
  onRemove: (id: string) => void;
}

export function MyPlansDrawer({
  open,
  onClose,
  itineraries,
  onOpen,
  onRemove,
}: MyPlansDrawerProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  function handleOpen(plan: SavedItinerary) {
    setConfirmId(null);
    onOpen(plan);
    onClose();
  }

  function handleDelete(id: string) {
    if (confirmId === id) {
      onRemove(id);
      setConfirmId(null);
    } else {
      setConfirmId(id);
    }
  }

  return (
    <BottomSheet open={open} onClose={onClose} kicker="Saved plans" title="My plans">
      {itineraries.length === 0 ? (
        <p className="sbd-swap-empty">No saved plans yet — build a day and tap Save plan.</p>
      ) : (
        itineraries.map((plan) => (
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
                    key={s.id}
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
        ))
      )}
      <p className="sbd-myplans-footer">These also live in Saved › Days.</p>
    </BottomSheet>
  );
}
