import type { ReactNode } from "react";

export type TagColor = "gold" | "sage" | "terracotta" | "pacific" | "neutral";

/** Static label pill (occasion tag, badge). Accent FILL with readable text. */
export function Tag({
  color = "neutral",
  micro = false,
  children,
  className = "",
}: {
  color?: TagColor;
  micro?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const cls = [
    "sbd-tag",
    `sbd-tag--${color}`,
    micro ? "sbd-tag--micro" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  return <span className={cls}>{children}</span>;
}

/** Toggleable filter chip (controlled via `pressed` + `onToggle`). */
export function Chip({
  pressed = false,
  onToggle,
  children,
}: {
  pressed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="sbd-chip"
      aria-pressed={pressed}
      onClick={onToggle}
    >
      {children}
    </button>
  );
}
