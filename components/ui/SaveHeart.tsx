"use client";

import { useState } from "react";

function HeartIcon({ filled }: { filled: boolean }) {
  return (
    <svg
      className="sbd-heart__icon"
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

/**
 * The save heart. Controlled via `saved` + `onToggle`.
 * Carries the required aria-label ("Save {title}" / "Saved {title}") and a
 * pop animation that is disabled under prefers-reduced-motion (CLAUDE.md §6).
 */
export function SaveHeart({
  saved,
  onToggle,
  title,
  overlay = false,
}: {
  saved: boolean;
  onToggle: () => void;
  title: string;
  overlay?: boolean;
}) {
  const [pop, setPop] = useState(false);

  const cls = [
    "sbd-heart",
    overlay ? "sbd-heart--overlay" : "",
    pop ? "sbd-heart--pop" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type="button"
      className={cls}
      aria-pressed={saved}
      aria-label={saved ? `Saved ${title}` : `Save ${title}`}
      onClick={() => {
        onToggle();
        setPop(true);
      }}
      onAnimationEnd={() => setPop(false)}
    >
      <HeartIcon filled={saved} />
    </button>
  );
}
