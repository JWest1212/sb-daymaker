"use client";

/**
 * The Plan surface's header: logo mark + "Plan" + tagline, with a right-aligned
 * "My plans" collapsible button. The drawer it opens is wired in Phase 7 — for now
 * it's an accessible stub.
 */
export function PlanHeader() {
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
        disabled
      >
        <span aria-hidden="true">🗓</span>
        My plans
        <span className="sbd-myplans-btn__chevron" aria-hidden="true">
          ▾
        </span>
      </button>
    </header>
  );
}
