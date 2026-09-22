"use client";

import { SpineStopCard } from "./SpineStopCard";
import { BLOCK_LABEL } from "@/lib/plan/labels";
import type { Block, Stop, Transition } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

const BLOCK_NODE: Record<Block, { glyph: string; color: string }> = {
  morning:   { glyph: "🌅", color: "var(--tod-morning)" },
  afternoon: { glyph: "⛅", color: "var(--tod-afternoon)" },
  night:     { glyph: "🌙", color: "var(--tod-night)" },
};

interface ItinerarySpineProps {
  sections: Block[];              // from answers.periods, in selected order
  stops: Stop[];                  // all user-added stops, insertion order
  things: Map<string, Thing>;
  /** Gate 4 · G4.4, transition annotation keyed by the arrival stop id. */
  transitions?: Map<string, Transition>;
  onAddStop: (block: Block) => void;
  onRemoveStop: (stopId: string) => void;
  onSwapStop?: (stopId: string) => void;
  /** R1 W3.2. Blocks the engine could not fill from the pool at all, as opposed
   *  to blocks the visitor emptied themselves. Only the former gets the "nothing
   *  found" line; the slot itself renders either way, so the shape of the day
   *  still reads. */
  unfilledBlocks?: Set<Block>;
}

export function ItinerarySpine({
  sections,
  stops,
  things,
  transitions,
  onAddStop,
  onRemoveStop,
  onSwapStop,
  unfilledBlocks,
}: ItinerarySpineProps) {
  return (
    <div className="sbd-spine">
      <div className="sbd-spine__rail" aria-hidden="true" />
      {sections.map((block) => {
        const node = BLOCK_NODE[block];
        const label = BLOCK_LABEL[block];
        const sectionStops = stops.filter((s) => s.block === block);

        return (
          <div key={block} className="sbd-section">
            {/* Section header: colored node + label */}
            <div className="sbd-section__hd">
              <div
                className="sbd-node"
                style={{ background: node.color }}
                aria-hidden="true"
              >
                {node.glyph}
              </div>
              <span className="sbd-section__lbl">{label}</span>
            </div>

            {/* Stops for this section (insertion order) */}
            <div className="sbd-section__items">
              {sectionStops.map((s) => {
                const thing = things.get(s.thingId);
                if (!thing) return null;
                const tr = transitions?.get(s.id);
                return (
                  <div key={s.id}>
                    {tr ? (
                      <div className="sbd-transit">
                        <span className="sbd-transit__ln" aria-hidden="true" />
                        <span className="sbd-transit__tx">
                          <span aria-hidden="true">{tr.mode === "walk" ? "🚶" : "🚗"}</span> {tr.label}
                        </span>
                        <span className="sbd-transit__ln" aria-hidden="true" />
                      </div>
                    ) : null}
                    <SpineStopCard
                      stop={s}
                      thing={thing}
                      onRemove={() => onRemoveStop(s.id)}
                      onSwap={onSwapStop ? () => onSwapStop(s.id) : undefined}
                    />
                  </div>
                );
              })}

              {/* R1 W3.2. Say why the slot is empty when the pool had nothing,
                  rather than leaving an inviting "add your first stop" that
                  implies the visitor simply has not got round to it. */}
              {sectionStops.length === 0 && unfilledBlocks?.has(block) ? (
                <p className="sbd-section__unfilled">
                  Nothing found for {label.toLowerCase()} yet. Add a stop or widen the plan.
                </p>
              ) : null}

              {/* Trailing empty slot, always present */}
              <button
                type="button"
                className="sbd-addslot"
                aria-label={`Add a stop to your ${label.toLowerCase()}`}
                onClick={() => onAddStop(block)}
              >
                <span className="sbd-addslot__plus" aria-hidden="true">＋</span>
                {sectionStops.length === 0
                  ? `Add your first ${label.toLowerCase()} stop`
                  : "Add another stop"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
