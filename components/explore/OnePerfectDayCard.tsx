"use client";

import { useRouter } from "next/navigation";
import { useSaves } from "@/components/saves/SavesProvider";

/** One Perfect SB Day, seeds the saved list with a curated lineup in one tap. */
export function OnePerfectDayCard({ ids }: { ids: string[] }) {
  const { saveMany } = useSaves();
  const router = useRouter();

  if (ids.length === 0) return null;

  const seedDay = () => {
    saveMany(ids);
    router.push("/saved");
  };

  return (
    <button type="button" className="sbd-opd" onClick={seedDay}>
      <span className="sbd-opd__overlay" aria-hidden="true" />
      <span className="sbd-opd__body">
        <span className="sbd-opd__eyebrow">Here for the day?</span>
        <span className="sbd-opd__title">One Perfect SB Day</span>
        <span className="sbd-opd__sub">
          A hand-picked lineup, saved to your list in one tap →
        </span>
      </span>
    </button>
  );
}
