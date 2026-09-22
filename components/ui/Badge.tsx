import type { ReactNode } from "react";

/**
 * R1 Wave 3 (W3.5). A badge that sits NEXT TO text rather than welded onto it.
 *
 * The bug this replaces: a badge span placed immediately after a text node with
 * no separator, so the accessible name and any text extraction ran the two
 * together. The audit found "Cookingdinner" on a Plan stop, and "AFTERNOONNOW"
 * and "THE CORENOW" on the guide chapter headings. Visually a margin hid it;
 * to a screen reader it was one word.
 *
 * Three things make that impossible here:
 *
 * 1. A leading space inside the element, so the text stream always separates.
 *    `margin` is a visual fix only and does nothing for the accessible name.
 * 2. Its own `aria-label`, so the badge announces its meaning ("happening now")
 *    rather than an abbreviation read as part of the previous word.
 * 3. `role="note"` when a label is given, so it is announced as a distinct thing.
 *
 * Purely decorative repetition of adjacent text should pass `decorative`, which
 * hides it from assistive tech entirely instead of saying it twice.
 */
export function Badge({
  children,
  label,
  tone = "neutral",
  decorative = false,
  className = "",
}: {
  children: ReactNode;
  /** What the badge MEANS, for assistive tech, e.g. "happening now". */
  label?: string;
  tone?: "neutral" | "now" | "meal" | "suggested" | "saved";
  /** True when the badge only repeats adjacent visible text. */
  decorative?: boolean;
  className?: string;
}) {
  const cls = ["sbd-badge", `sbd-badge--${tone}`, className].filter(Boolean).join(" ");
  if (decorative) {
    return (
      <>
        {" "}
        <span className={cls} aria-hidden="true">
          {children}
        </span>
      </>
    );
  }
  return (
    <>
      {/* A real space in the text stream, not a margin. This is the fix. */}
      {" "}
      <span className={cls} role="note" aria-label={label}>
        {children}
      </span>
    </>
  );
}
