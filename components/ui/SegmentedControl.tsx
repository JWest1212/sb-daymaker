"use client";

import { useRef } from "react";

interface Option {
  label: string;
  value: string;
  /** Fuller accessible name when the visible label is abbreviated (Label-in-Name). */
  ariaLabel?: string;
}

/** Segmented switch (e.g. Today · This Week · This Month). Controlled. Tablist with
 *  roving tabindex + arrow-key navigation (Home Rework spec §14 — Horizon segment). */
export function SegmentedControl({
  options,
  value,
  onChange,
  ariaLabel,
}: {
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel?: string;
}) {
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const move = (fromIndex: number, dir: 1 | -1) => {
    const next = (fromIndex + dir + options.length) % options.length;
    onChange(options[next].value);
    btnRefs.current[next]?.focus();
  };

  return (
    <div className="sbd-seg" role="tablist" aria-label={ariaLabel}>
      {options.map((o, i) => (
        <button
          key={o.value}
          ref={(el) => {
            btnRefs.current[i] = el;
          }}
          type="button"
          role="tab"
          aria-selected={value === o.value}
          aria-label={o.ariaLabel}
          tabIndex={value === o.value ? 0 : -1}
          className="sbd-seg__btn"
          onClick={() => onChange(o.value)}
          onKeyDown={(e) => {
            if (e.key === "ArrowRight" || e.key === "ArrowDown") {
              e.preventDefault();
              move(i, 1);
            } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
              e.preventDefault();
              move(i, -1);
            }
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
