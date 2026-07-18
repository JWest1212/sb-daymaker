"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui";
import { ZONES, nearestZone, type Zone } from "@/lib/zones";

export function NearMeSheet({
  open,
  current,
  onClose,
  onSelect,
}: {
  open: boolean;
  current: Zone | null;
  onClose: () => void;
  onSelect: (zone: Zone | null) => void;
}) {
  const [status, setStatus] = useState<"idle" | "locating" | "denied">("idle");

  const useMyLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setStatus("denied");
      return;
    }
    setStatus("locating");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const zone = nearestZone(pos.coords.latitude, pos.coords.longitude);
        setStatus("idle");
        onSelect(zone);
      },
      () => setStatus("denied"), // denied → fall back to the manual picker below
      { timeout: 8000 },
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      kicker="Near Me"
      title="Sort by what's closest"
    >
      <button
        type="button"
        className="sbd-near-locate"
        onClick={useMyLocation}
        disabled={status === "locating"}
      >
        📍 {status === "locating" ? "Finding you…" : "Use my location"}
      </button>

      {status === "denied" ? (
        <p className="sbd-near-note">
          No location, no problem. Pick a neighborhood instead.
        </p>
      ) : (
        <p className="sbd-near-note">Or choose a neighborhood:</p>
      )}

      <div className="sbd-near-list">
        {ZONES.map((z) => (
          <button
            key={z.zone}
            type="button"
            className={`sbd-near-opt${current === z.zone ? " is-active" : ""}`}
            onClick={() => onSelect(z.zone)}
          >
            {z.label}
          </button>
        ))}
        <button
          type="button"
          className={`sbd-near-opt${current === null ? " is-active" : ""}`}
          onClick={() => onSelect(null)}
        >
          Anywhere in SB
        </button>
      </div>
    </BottomSheet>
  );
}
