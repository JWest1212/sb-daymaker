"use client";

import { SBIcon } from "@/components/ui/SBIcon";

import { useState } from "react";
import { BottomSheet } from "@/components/ui";
import { AREAS, ANYWHERE_LABEL, nearestArea, type AreaKey } from "@/lib/areas";

export function NearMeSheet({
  open,
  current,
  onClose,
  onSelect,
}: {
  open: boolean;
  current: AreaKey | null;
  onClose: () => void;
  onSelect: (zone: AreaKey | null) => void;
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
        const zone = nearestArea(pos.coords.latitude, pos.coords.longitude);
        setStatus("idle");
        onSelect(zone);
      },
      () => setStatus("denied"), // denied or timed out, fall back to the list below
      // R1 W4.3 (SAV-007): 6 seconds, then the manual list. A spinner that
      // never resolves is worse than an honest fallback.
      { timeout: 6000 },
    );
  };

  return (
    <BottomSheet
      open={open}
      onClose={onClose}
      kicker="Near Me"
      title="Which area are you in?"
    >
      <button
        type="button"
        className="sbd-near-locate"
        onClick={useMyLocation}
        disabled={status === "locating"}
      >
        <SBIcon name="pin" size={16} /> {status === "locating" ? "Finding you…" : "Use my location"}
      </button>

      {status === "denied" ? (
        <p className="sbd-near-note">
          Couldn&apos;t get your location. Pick an area instead.
        </p>
      ) : (
        <p className="sbd-near-note">Or choose an area:</p>
      )}

      <div className="sbd-near-list">
        {AREAS.map((a) => (
          <button
            key={a.key}
            type="button"
            className={`sbd-near-opt${current === a.key ? " is-active" : ""}`}
            onClick={() => onSelect(a.key)}
          >
            {a.label}
          </button>
        ))}
        <button
          type="button"
          className={`sbd-near-opt${current === null ? " is-active" : ""}`}
          onClick={() => onSelect(null)}
        >
          {ANYWHERE_LABEL}
        </button>
      </div>
    </BottomSheet>
  );
}
