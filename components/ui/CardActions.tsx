"use client";

import { rememberSaveTitles } from "@/lib/saveTitles";
import { useState } from "react";
import { useSaves } from "@/components/saves/SavesProvider";
import { useShareLink } from "@/components/saved/useShareLink";
import { SBIcon } from "./SBIcon";

export function CardActions({
  id,
  title,
  url,
  onImage,
}: {
  id: string;
  title: string;
  url: string;
  onImage: boolean;
}) {
  const { isSaved, toggle } = useSaves();
  const [pop, setPop] = useState(false);
  const saved = isSaved(id);
  // R1 W1.5. This used to call shareUrl fire-and-forget with no feedback at all.
  const { share, sheet } = useShareLink();

  return (
    <div className={`sbd-cardact${onImage ? " sbd-cardact--on-image" : ""}`}>
      <button
        type="button"
        className={`sbd-cardact__btn${pop ? " sbd-cardact__btn--pop" : ""}`}
        aria-label={saved ? `Saved ${title}` : `Save ${title}`}
        aria-pressed={saved}
        onClick={() => {
          // R1 W7.4: name it now, so an offline Saved list can too.
          if (!saved) rememberSaveTitles([{ id, title }]);
          toggle(id);
          setPop(true);
        }}
        onAnimationEnd={() => setPop(false)}
      >
        <SBIcon
          name="heart"
          size={18}
          strokeWidth={2}
          fill={saved ? "var(--terracotta)" : "none"}
          stroke={saved ? "var(--terracotta)" : "currentColor"}
        />
      </button>
      <button
        type="button"
        className="sbd-cardact__btn"
        aria-label={`Share ${title}`}
        onClick={() => {
          const absolute = url.startsWith("http")
            ? url
            : window.location.origin + url;
          void share(absolute, title);
        }}
      >
        <SBIcon name="share" size={18} strokeWidth={2} />
      </button>
      {sheet}
    </div>
  );
}
