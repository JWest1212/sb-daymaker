"use client";

import type { SaveState } from "@/components/saves/SavesProvider";

/**
 * T2: Want/Been toggle for the Saved page.
 * Two equal-width halves; active half fills with state color + leading icon.
 * want-active → --pacific (#16586A); been-active → #2F6248 (darkened forest, clears AA).
 */
export function SavedToggle({
  value,
  wantCount,
  beenCount,
  onChange,
}: {
  value: SaveState;
  wantCount: number;
  beenCount: number;
  onChange: (v: SaveState) => void;
}) {
  return (
    <div className="sbd-saved-toggle" role="tablist" aria-label="Saved state">
      <button
        type="button"
        role="tab"
        aria-selected={value === "want"}
        className={`sbd-saved-toggle__btn sbd-saved-toggle__btn--want${value === "want" ? " is-active" : ""}`}
        onClick={() => onChange("want")}
      >
        <span className="sbd-saved-toggle__icon" aria-hidden="true">♥</span>
        <span className="sbd-saved-toggle__label">Want to go</span>
        {wantCount > 0 ? (
          <span className="sbd-saved-toggle__chip">{wantCount}</span>
        ) : null}
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={value === "been"}
        className={`sbd-saved-toggle__btn sbd-saved-toggle__btn--been${value === "been" ? " is-active" : ""}`}
        onClick={() => onChange("been")}
      >
        <span className="sbd-saved-toggle__icon" aria-hidden="true">✓</span>
        <span className="sbd-saved-toggle__label">Been</span>
        {beenCount > 0 ? (
          <span className="sbd-saved-toggle__chip">{beenCount}</span>
        ) : null}
      </button>
    </div>
  );
}
