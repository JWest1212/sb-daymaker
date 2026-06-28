"use client";

import { useState } from "react";
import Link from "next/link";
import { BottomSheet } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";
import { naturalBlock, BLOCK_TIME_LABEL } from "@/lib/plan/buildDay";
import type { Thing } from "@/lib/things";

interface PinPickerSheetProps {
  things: Thing[];
  onBuild: (pinned: Thing[]) => void;
  onClose: () => void;
}

/** Short block name from the full time label, e.g. "Morning · 9–11 AM" → "Morning" */
function blockName(thing: Thing): string {
  return BLOCK_TIME_LABEL[naturalBlock(thing)].split(" · ")[0];
}

export function PinPickerSheet({ things, onBuild, onClose }: PinPickerSheetProps) {
  const { state } = useSaves();
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const savedThings = things.filter((t) => state(t.id) === "want");

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleBuild() {
    onBuild(savedThings.filter((t) => selected.has(t.id)));
  }

  if (savedThings.length === 0) {
    return (
      <BottomSheet open onClose={onClose} kicker="Your saved spots" title="Build around your saved">
        <p className="sbd-swap-empty">No saved spots yet — heart some stops first.</p>
      </BottomSheet>
    );
  }

  return (
    <BottomSheet open onClose={onClose} kicker="Your saved spots" title="Build around your saved">
      {savedThings.map((thing) => {
        const isSelected = selected.has(thing.id);
        return (
          <div
            key={thing.id}
            className={`sbd-pinopt${isSelected ? " sbd-pinopt--sel" : ""}`}
          >
            <button
              type="button"
              className="sbd-pinopt__select"
              onClick={() => toggle(thing.id)}
              aria-pressed={isSelected}
              aria-label={isSelected ? `${thing.title} selected` : `Select ${thing.title}`}
            >
              {thing.photo_url ? (
                <img
                  className="sbd-pinopt__thumb"
                  src={thing.photo_url}
                  alt=""
                  loading="lazy"
                />
              ) : (
                <div
                  className="sbd-pinopt__thumb sbd-media--sage"
                  aria-hidden="true"
                />
              )}
              <div className="sbd-pinopt__body">
                <span className="sbd-pinopt__nm">{thing.title}</span>
                <span className="sbd-pinopt__blk">→ {blockName(thing)}</span>
              </div>
            </button>
            <Link
              href={`/thing/${thing.id}`}
              className="sbd-pinopt__info"
              aria-label={`Details for ${thing.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <span aria-hidden="true">i</span>
            </Link>
            <button
              type="button"
              className="sbd-pinopt__ck"
              onClick={() => toggle(thing.id)}
              aria-pressed={isSelected}
              aria-label={isSelected ? `${thing.title} selected` : `Select ${thing.title}`}
            >
              {isSelected ? "✓" : ""}
            </button>
          </div>
        );
      })}

      <p className="sbd-pinhelper">We&rsquo;ll fill the empty blocks with picks nearby.</p>

      <button
        type="button"
        className="sbd-btn sbd-btn--primary sbd-btn--block sbd-pinbuild"
        onClick={handleBuild}
        disabled={selected.size === 0}
      >
        Build my day around these ({selected.size}) →
      </button>
    </BottomSheet>
  );
}
