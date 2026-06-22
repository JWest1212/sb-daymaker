"use client";

import { useEffect, useRef, type ReactNode } from "react";

/**
 * Bottom sheet (modal). Scrim + slide-up panel with a grab handle.
 * Closes on backdrop click and Escape; locks body scroll while open; moves
 * focus into the panel. Animations are disabled under prefers-reduced-motion
 * via CSS (CLAUDE.md §6).
 */
export function BottomSheet({
  open,
  onClose,
  title,
  kicker,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  kicker?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sbd-scrim" onClick={onClose}>
      <div
        className="sbd-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panelRef}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sbd-sheet__grab" aria-hidden="true" />
        {kicker ? <div className="sbd-sheet__kicker">{kicker}</div> : null}
        {title ? <h2 className="sbd-sheet__title">{title}</h2> : null}
        {children}
      </div>
    </div>
  );
}
