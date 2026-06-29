"use client";

import { SpineStopCard } from "./SpineStopCard";
import { BLOCK_LABEL } from "@/lib/plan/labels";
import type { Block, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

const BLOCK_NODE: Record<Block, { glyph: string; color: string }> = {
  morning:   { glyph: "🌅", color: "var(--tod-morning)" },
  afternoon: { glyph: "⛅", color: "var(--tod-afternoon)" },
  evening:   { glyph: "🌆", color: "var(--tod-evening)" },
  late:      { glyph: "🌙", color: "var(--tod-night)" },
};

interface ItinerarySpineProps {
  sections: Block[];              // from answers.periods, in selected order
  stops: Stop[];                  // all user-added stops, insertion order
  things: Map<string, Thing>;
  onAddStop: (block: Block) => void;
  onRemoveStop: (stopId: string) => void;
}

export function ItinerarySpine({
  sections,
  stops,
  things,
  onAddStop,
  onRemoveStop,
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
                return (
                  <SpineStopCard
                    key={s.id}
                    stop={s}
                    thing={thing}
                    onRemove={() => onRemoveStop(s.id)}
                  />
                );
              })}

              {/* Trailing empty slot — always present */}
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
