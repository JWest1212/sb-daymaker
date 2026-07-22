"use client";

import { useEffect, useRef } from "react";
import { useFocusTrap } from "@/lib/useFocusTrap";

// S3a, the one dialog primitive every Cockpit sheet/modal adopts: focus-trapped
// (lib/useFocusTrap.ts), Escape closes, scrim click closes, focus restores to
// the opener (useFocusTrap's own job), labelled header with a close button and
// a teachable "Esc closes" hint, footer slot. Per mockup r2 (docs/cockpit/
// cockpit_mockups_r2.html #sheet).
//
// `manageEscape` defaults to true (the sheet owns Escape-to-close). Set it to
// false when a screen has its own multi-layer Escape priority to preserve
// (Coverage: the restock modal must close before the drilldown on a single
// Escape press, load-bearing per 11-change-safety.md), the caller then wires
// Escape itself and this component only renders + traps focus.
export function Sheet({
  open, onClose, titleId, title, footer, wide, manageEscape = true, children,
}: {
  open: boolean;
  onClose: () => void;
  titleId: string;
  title: React.ReactNode;
  footer?: React.ReactNode;
  wide?: boolean;
  manageEscape?: boolean;
  children: React.ReactNode;
}) {
  const sheetRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(sheetRef, open);

  useEffect(() => {
    if (!open || !manageEscape) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, manageEscape, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="scrim show" onClick={onClose} />
      <div
        className={`sheet show${wide ? " sheet--wide" : ""}`}
        role="dialog" aria-modal="true" aria-labelledby={titleId}
        ref={sheetRef}
      >
        <h3 id={titleId}>
          {title}
          <span className="esc-hint">Esc closes</span>
          <button type="button" className="x" aria-label="Close" onClick={onClose}>✕</button>
        </h3>
        <div className="sbody">{children}</div>
        {footer ? <div className="sfoot">{footer}</div> : null}
      </div>
    </>
  );
}

/** S3a, the small centered variant that replaces window.confirm for
 *  destructive/consequential actions: a title, a body, and confirm/cancel
 *  buttons (confirm styled dangerous when `danger` is set). */
export function Confirm({
  open, title, body, confirmLabel = "Confirm", cancelLabel = "Cancel", danger, onConfirm, onCancel,
}: {
  open: boolean;
  title: string;
  body: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useFocusTrap(ref, open);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;
  return (
    <>
      <div className="scrim show" onClick={onCancel} />
      <div
        className="sheet sheet--confirm show" role="alertdialog" aria-modal="true" aria-labelledby="sheet-confirm-title"
        ref={ref}
      >
        <h3 id="sheet-confirm-title">
          {title}
          <span className="esc-hint">Esc closes</span>
        </h3>
        <div className="sbody"><p style={{ margin: 0, fontSize: ".9rem", color: "var(--ink-2)", whiteSpace: "pre-line" }}>{body}</p></div>
        <div className="sfoot">
          <button type="button" className="btn btn-edit" onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className={`btn ${danger ? "btn-reject" : "btn-approve"}`} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </>
  );
}
