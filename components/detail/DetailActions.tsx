"use client";

// Elevation v1 · Gate 1 · G1.3, the Save / Share / Directions action row.
// Save + Share reuse the same on-device save store + native-share helper the
// cards use (no new PII, no account). Directions is a plain outbound deep link to
// the user's native maps app (no embedded map, no Maps API cost, the locked
// decision). Share's per-thing OG card is Gate 5; the button is live here (it
// shares the URL), Gate 5 makes the preview a designed artifact.

import { useState } from "react";
import { useSaves } from "@/components/saves/SavesProvider";
import { shareUrl } from "@/components/saved/share";
import { SBIcon } from "@/components/ui/SBIcon";

export function DetailActions({
  id,
  title,
  directionsHref,
}: {
  id: string;
  title: string;
  directionsHref: string | null;
}) {
  const { isSaved, toggle } = useSaves();
  const [pop, setPop] = useState(false);
  const saved = isSaved(id);

  return (
    <div className="sbd-detail__actionrow">
      <button
        type="button"
        className={`sbd-detailact${saved ? " sbd-detailact--on" : ""}${pop ? " sbd-detailact--pop" : ""}`}
        aria-label={saved ? `Saved ${title}` : `Save ${title}`}
        aria-pressed={saved}
        onClick={() => {
          toggle(id);
          setPop(true);
        }}
        onAnimationEnd={() => setPop(false)}
      >
        <SBIcon
          name="heart"
          size={20}
          strokeWidth={2}
          fill={saved ? "var(--terracotta)" : "none"}
          stroke={saved ? "var(--terracotta)" : "currentColor"}
        />
        <span>{saved ? "Saved" : "Save"}</span>
      </button>

      <button
        type="button"
        className="sbd-detailact"
        aria-label={`Share ${title}`}
        onClick={() => {
          const url = `${window.location.origin}/thing/${id}`;
          shareUrl(url, title);
        }}
      >
        <SBIcon name="share" size={20} strokeWidth={2} />
        <span>Share</span>
      </button>

      {directionsHref ? (
        <a
          className="sbd-detailact"
          href={directionsHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Directions to ${title}`}
        >
          <SBIcon name="pin" size={20} strokeWidth={2} />
          <span>Directions</span>
        </a>
      ) : null}
    </div>
  );
}
