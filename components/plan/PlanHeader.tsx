"use client";

export function PlanHeader() {
  return (
    <header className="sbd-header sbd-plan-header">
      <span className="sbd-header__mark" aria-hidden="true">S</span>
      <span className="sbd-plan-header__brand">
        <span className="sbd-header__name">Plan your day</span>
        <span className="sbd-header__tag" style={{ display: "block" }}>
          Santa Barbara
        </span>
      </span>
    </header>
  );
}
