"use client";

import { useState } from "react";
import { useSaves } from "@/components/saves/SavesProvider";
import { shareUrl } from "@/components/saved/share";
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

  return (
    <div className={`sbd-cardact${onImage ? " sbd-cardact--on-image" : ""}`}>
      <button
        type="button"
        className={`sbd-cardact__btn${pop ? " sbd-cardact__btn--pop" : ""}`}
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
          shareUrl(absolute, title);
        }}
      >
        <SBIcon name="share" size={18} strokeWidth={2} />
      </button>
    </div>
  );
}
