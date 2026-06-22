import type { ReactNode } from "react";

/** Friendly empty-state block: dashed border, icon, title, message, action. */
export function EmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon?: ReactNode;
  title?: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="sbd-empty">
      {icon ? (
        <div className="sbd-empty__icon" aria-hidden="true">
          {icon}
        </div>
      ) : null}
      {title ? <div className="sbd-empty__title">{title}</div> : null}
      <p className="sbd-empty__msg">{message}</p>
      {action ? <div className="sbd-empty__action">{action}</div> : null}
    </div>
  );
}
