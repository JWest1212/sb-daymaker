"use client";

import { SBIcon } from "./SBIcon";

export function SectionHeader({
  mode,
  label,
  count,
  dek,
  expanded,
  onToggle,
  controlsId,
}: {
  mode: "lead" | "collapsible";
  label: string;
  count?: number;
  dek?: string | null;
  expanded?: boolean;
  onToggle?: () => void;
  controlsId?: string;
}) {
  if (mode === "lead") {
    return (
      <div className="sbd-sh2 sbd-sh2--lead">
        <h2 className="sbd-sh2__label">{label}</h2>
        <div className="sbd-sh__rule" aria-hidden="true" />
        {dek ? <p className="sbd-sh2__dek">{dek}</p> : null}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="sbd-sh2 sbd-sh2--coll"
      aria-expanded={expanded}
      aria-controls={controlsId}
      onClick={onToggle}
    >
      <span className="sbd-sh2__label">{label}</span>
      {count !== undefined ? (
        <span className="sbd-sh2__count" aria-label={`${count} items`}>
          {count}
        </span>
      ) : null}
      <span
        className={`sbd-sh2__chev${expanded ? " sbd-sh2__chev--open" : ""}`}
        aria-hidden="true"
      >
        <SBIcon name="chevron" size={16} strokeWidth={2} />
      </span>
    </button>
  );
}
