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
  ariaLabel,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  kicker?: string;
  /** Accessible name when no visible `title` is rendered. Ignored if `title` is set. */
  ariaLabel?: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    // Home Rework spec §11.2/§14 — focus returns to whatever opened the sheet
    // (e.g. a Discovery door) on close. Same pattern as lib/useFocusTrap.ts.
    triggerRef.current = document.activeElement as HTMLElement | null;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Trap Tab focus within the sheet while it's open (WCAG focus order).
      if (e.key === "Tab" && panelRef.current) {
        const focusable = panelRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          e.preventDefault();
          return;
        }
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement;
        if (e.shiftKey && (active === first || active === panelRef.current)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    panelRef.current?.focus();

    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      triggerRef.current?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="sbd-scrim" onClick={onClose}>
      <div
        className="sbd-sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title ?? ariaLabel}
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
