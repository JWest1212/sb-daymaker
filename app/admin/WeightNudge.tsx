"use client";

import { useState } from "react";

/** W2.1c — the compact ▲ n ▼ founder-curation gesture, shared by the Queue's
 *  ReviewCard and each Live-catalog row. Posts editorial_weight to /api/admin/weight
 *  (metadata-immediate, like the hero flag — no re-review). Optimistic with
 *  revert-on-error via the host's toast. This is founder curation the ranker is
 *  allowed to read; it is NOT sponsor placement. Keep it a two-second gesture. */
export function WeightNudge({
  thingId,
  title,
  weight: initial,
  onToast,
}: {
  thingId: string;
  title: string;
  weight: number;
  onToast?: (msg: string) => void;
}) {
  const [weight, setWeight] = useState(initial);
  const [busy, setBusy] = useState(false);

  const nudge = async (delta: number) => {
    const next = Math.max(-5, Math.min(5, weight + delta));
    if (next === weight || busy) return;
    const prev = weight;
    setWeight(next); // optimistic
    setBusy(true);
    try {
      const res = await fetch("/api/admin/weight", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thing_id: thingId, weight: next }),
      })
        .then((r) => r.json())
        .catch(() => null);
      if (!res?.ok) {
        setWeight(prev); // revert
        onToast?.("Weight change failed — reverted");
      } else {
        onToast?.(delta > 0 ? `▲ Boosted ${title}` : `▼ Lowered ${title}`);
      }
    } finally {
      setBusy(false);
    }
  };

  const label = weight > 0 ? `+${weight}` : String(weight);
  const valCls = weight > 0 ? "wval pos" : weight < 0 ? "wval neg" : "wval";

  return (
    <div className="wnudge" role="group" aria-label={`Editorial weight for ${title}`} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="wbtn"
        aria-label={`Boost ${title}`}
        title="Boost — nudge up the ranking"
        disabled={busy || weight >= 5}
        onClick={(e) => { e.stopPropagation(); nudge(1); }}
      >
        ▲
      </button>
      <span className={valCls} aria-live="polite">{label}</span>
      <button
        type="button"
        className="wbtn"
        aria-label={`Lower ${title}`}
        title="Lower — sink in the ranking"
        disabled={busy || weight <= -5}
        onClick={(e) => { e.stopPropagation(); nudge(-1); }}
      >
        ▼
      </button>
    </div>
  );
}
