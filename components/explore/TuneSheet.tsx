"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/ui/BottomSheet";
import { OCCASIONS, type OccasionKey } from "@/lib/occasions";
import { ZONES, nearestZone, type Zone } from "@/lib/zones";

export function TuneSheet({
  open,
  currentLens,
  currentZone,
  onClose,
  onLens,
  onZone,
}: {
  open: boolean;
  currentLens: OccasionKey | null;
  currentZone: Zone | null;
  onClose: () => void;
  onLens: (lens: OccasionKey | null) => void;
  onZone: (zone: Zone | null) => void;
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
        onZone(zone);
      },
      () => setStatus("denied"),
      { timeout: 8000 },
    );
  };

  return (
    <BottomSheet open={open} onClose={onClose} kicker="Tune your day" title="Vibe & location">
      {/* Vibe section */}
      <section className="sbd-tune-section">
        <button
          type="button"
          className={`sbd-tune-any${currentLens === null ? " is-active" : ""}`}
          onClick={() => onLens(null)}
        >
          Any vibe — show everything
        </button>
        <div className="sbd-tune-grid">
          {OCCASIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              className={`sbd-tune-opt${currentLens === o.key ? " is-active" : ""}`}
              onClick={() => onLens(o.key)}
            >
              <span
                className="sbd-tune-opt__tile"
                aria-hidden="true"
                style={{ background: o.color }}
              />
              <span className="sbd-tune-opt__label">{o.label}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Location section */}
      <section className="sbd-tune-section">
        <h3 className="sbd-tune-section__hd">Location</h3>
        <button
          type="button"
          className="sbd-near-locate"
          onClick={useMyLocation}
          disabled={status === "locating"}
        >
          {status === "locating" ? "Finding you…" : "Use my location"}
        </button>
        {status === "denied" ? (
          <p className="sbd-near-note">
            No location — no problem. Pick a neighborhood instead.
          </p>
        ) : (
          <p className="sbd-near-note">Or choose a neighborhood:</p>
        )}
        <div className="sbd-near-list">
          {ZONES.map((z) => (
            <button
              key={z.zone}
              type="button"
              className={`sbd-near-opt${currentZone === z.zone ? " is-active" : ""}`}
              onClick={() => onZone(z.zone)}
            >
              {z.label}
            </button>
          ))}
          <button
            type="button"
            className={`sbd-near-opt${currentZone === null ? " is-active" : ""}`}
            onClick={() => onZone(null)}
          >
            Anywhere in SB
          </button>
        </div>
      </section>

      {/* Show results */}
      <div className="sbd-tune-foot">
        <button type="button" className="sbd-tune-submit" onClick={onClose}>
          Show results
        </button>
      </div>
    </BottomSheet>
  );
}
