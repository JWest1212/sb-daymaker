"use client";

import { useEffect, useState } from "react";

interface Budget { used: number; cap: number; month: string; }

/** LC-8 / V-10, shared cost-visibility chip: "used / cap this month", turns
 *  amber near the cap. Fetches its own state (no prop threading) so it drops
 *  into the catalog picker and the venues fetch panel independently. */
export function BudgetChip() {
  const [budget, setBudget] = useState<Budget | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/image-budget").then((r) => r.json()).then((res) => {
      if (!cancelled && typeof res?.used === "number" && typeof res?.cap === "number") setBudget(res);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  if (!budget) return null;
  const near = budget.cap > 0 && budget.used / budget.cap >= 0.9;

  return (
    <span
      className={`budget-chip${near ? " is-near" : ""}`}
      title="Google Places photo calls this month, resets on the 1st"
    >
      {budget.used}/{budget.cap} Google calls
    </span>
  );
}
