"use client";

interface PlanHeaderProps {
  itineraryCount: number;
  onMyPlans: () => void;
}

export function PlanHeader({ itineraryCount, onMyPlans }: PlanHeaderProps) {
  return (
    <header className="sbd-header sbd-plan-header">
      <span className="sbd-header__mark" aria-hidden="true">
        S
      </span>
      <span className="sbd-plan-header__brand">
        <span className="sbd-header__name">Plan</span>
        <span className="sbd-header__tag" style={{ display: "block" }}>
          Build your Santa Barbara day
        </span>
      </span>
      <button
        type="button"
        className="sbd-myplans-btn"
        aria-label="My plans"
        aria-expanded={false}
        onClick={onMyPlans}
      >
        <span aria-hidden="true">🗓</span>
        My plans{itineraryCount > 0 ? ` · ${itineraryCount}` : ""}
        <span className="sbd-myplans-btn__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
    </header>
  );
}
