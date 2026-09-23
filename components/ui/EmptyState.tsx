import type { ReactNode } from "react";

/** Friendly empty-state block: dashed border, icon, title, message, action. */
export function EmptyState({
  icon,
  title,
  message,
  action,
  titleAs = "div",
}: {
  icon?: ReactNode;
  title?: string;
  message: string;
  action?: ReactNode;
  /** R1 W7.8. "h1" when the empty state IS the page (a not-found page), so
   *  the page still has a title in its heading outline. */
  titleAs?: "div" | "h1" | "h2";
}) {
  const Title = titleAs;
  return (
    <div className="sbd-empty">
      {icon ? (
        <div className="sbd-empty__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      {title ? <Title className="sbd-empty__title">{title}</Title> : null}
      <p className="sbd-empty__msg">{message}</p>
      {action ? <div className="sbd-empty__action">{action}</div> : null}
    </div>
  );
}
