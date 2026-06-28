"use client";

import { SpineStopCard } from "./SpineStopCard";
import type { Block, Stop } from "@/lib/plan/types";
import type { Thing } from "@/lib/things";

const BLOCK_NODE: Record<Block, { glyph: string; color: string }> = {
  morning: { glyph: "🌅", color: "var(--tod-morning)" },
  midday: { glyph: "☀️", color: "var(--tod-midday)" },
  afternoon: { glyph: "⛅", color: "var(--tod-afternoon)" },
  evening: { glyph: "🌆", color: "var(--tod-evening)" },
  night: { glyph: "🌙", color: "var(--tod-night)" },
};

interface ItinerarySpineProps {
  stops: Stop[];
  things: Map<string, Thing>;
  onSwap: (block: Block) => void;
}

export function ItinerarySpine({ stops, things, onSwap }: ItinerarySpineProps) {
  if (stops.length === 0) return null;

  return (
    <div className="sbd-spine">
      <div className="sbd-spine__rail" aria-hidden="true" />
      {stops.map((s) => {
        const thing = things.get(s.thingId);
        if (!thing) return null;
        const node = BLOCK_NODE[s.block];
        return (
          <div key={s.block} className="sbd-stop">
            <div
              className="sbd-node"
              style={{ background: node.color }}
              aria-hidden="true"
            >
              {node.glyph}
            </div>
            <SpineStopCard
              stop={s}
              thing={thing}
              onSwap={() => onSwap(s.block)}
            />
          </div>
        );
      })}
    </div>
  );
}
