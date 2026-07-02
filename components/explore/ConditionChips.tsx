"use client";

import { useEffect, useState } from "react";
import type { Weather } from "@/lib/weather";
import { sunsetMs } from "@/lib/sun";

// Santa Barbara, fixed (matches lib/weather.ts).
const SB_LAT = 34.4208;
const SB_LNG = -119.6982;
const GOLD_WINDOW_MIN = 90; // "golden hour" countdown starts 90 min before sunset

function sbTimeLabel(ms: number): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(ms);
}

/** Today's SB-local sunset instant, computed from the wall clock. */
function todaySunsetMs(now: number): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const g = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value);
  return sunsetMs(g("year"), g("month"), g("day"), SB_LAT, SB_LNG);
}

/**
 * The hero freshness line (spec §2.3): a weather chip (from stored pipeline
 * data) and a sunset / golden-hour-countdown chip (pure client-side math).
 * The sunset chip depends on the wall clock, so it is computed after mount to
 * keep SSR and the first client render identical (no hydration mismatch).
 */
export function ConditionChips({ weather }: { weather: Weather | null }) {
  const [sunLabel, setSunLabel] = useState<string | null>(null);

  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sunset = todaySunsetMs(Date.now());

    const render = () => {
      const minsLeft = Math.round((sunset - Date.now()) / 60_000);
      if (minsLeft > 0 && minsLeft <= GOLD_WINDOW_MIN) {
        setSunLabel(`${minsLeft} min of gold left`);
      } else {
        setSunLabel(`Sunset ${sbTimeLabel(sunset)}`);
      }
    };

    render();
    if (reduce) return; // reduced motion: freeze to the on-load value
    const id = setInterval(render, 60_000);
    return () => clearInterval(id);
  }, []);

  if (!weather && !sunLabel) return null;

  return (
    <div className="sbd-hero__cond">
      {weather ? (
        <span className="sbd-hero__chip">
          {weather.icon} {weather.tempF}°
        </span>
      ) : null}
      {sunLabel ? <span className="sbd-hero__chip">◐ {sunLabel}</span> : null}
    </div>
  );
}
