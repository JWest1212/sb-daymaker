"use client";

import { useEffect, useRef } from "react";
import {
  HORIZONS,
  HORIZON_PILL,
  horizonDateLine,
  type Horizon,
} from "@/lib/explore";

/**
 * R1 W6.2 (D7), redesigned 2026-09-22. The WHEN row: six tabs in the locked
 * order, Today through Month, in ONE line that scrolls sideways inside itself.
 *
 * It used to be a pill track that wrapped six pills onto two rows, 100px of the
 * pinned control block, with the columns of the two rows out of line. One row
 * keeps the pinned block short and reads as a single choice.
 *
 * Each tab shows its dates under the name ("Weekend / Sep 25-27"), because
 * "Weekend" alone does not say WHICH weekend, and "Week" does not say it means
 * the next seven days. The visible text IS the accessible name ("Weekend, Sep
 * 25-27"), so the dates are still announced (EXP-034) and a voice-control user
 * can say exactly what they see (label in name).
 *
 * The row scrolls inside its own box (never the page, TP-C1-01). Its edges fade
 * only when there is more to scroll that way, and the chosen tab is centred
 * whenever it changes, including on a shared link that opens on "Month".
 *
 * `nowMs` is passed in rather than read here so the server and the first client
 * render agree on the dates (a mismatch is a hydration error).
 */
export function HorizonSegment({
  horizon,
  onChange,
  nowMs,
}: {
  horizon: Horizon;
  onChange: (h: Horizon) => void;
  nowMs: number;
}) {
  const railRef = useRef<HTMLDivElement>(null);
  const btnRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const firstRun = useRef(true);

  // Edge fades only where there is more row to scroll to, so a hidden "Week" or
  // "Month" always announces itself as a fading tab at the edge. Written to the
  // DOM directly: a scroll position is not React state.
  useEffect(() => {
    const rail = railRef.current;
    if (!rail) return;
    const update = () => {
      const max = rail.scrollWidth - rail.clientWidth;
      rail.toggleAttribute("data-more-left", rail.scrollLeft > 2);
      rail.toggleAttribute("data-more-right", rail.scrollLeft < max - 2);
    };
    update();
    rail.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(rail);
    return () => {
      rail.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, []);

  // The chosen tab is centred in the row, which also brings its neighbours into
  // view. On first render (a link that opens on "Month") it jumps; after that it
  // glides, unless the visitor prefers reduced motion.
  useEffect(() => {
    const rail = railRef.current;
    const btn = btnRefs.current[HORIZONS.indexOf(horizon)];
    if (!rail || !btn) return;
    const left = btn.getBoundingClientRect().left - rail.getBoundingClientRect().left + rail.scrollLeft;
    const max = rail.scrollWidth - rail.clientWidth;
    const target = Math.min(max, Math.max(0, left + btn.offsetWidth / 2 - rail.clientWidth / 2));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (Math.abs(target - rail.scrollLeft) > 1) {
      rail.scrollTo({ left: target, behavior: firstRun.current || reduce ? "auto" : "smooth" });
    }
    firstRun.current = false;
  }, [horizon]);

  const move = (fromIndex: number, dir: 1 | -1) => {
    const next = (fromIndex + dir + HORIZONS.length) % HORIZONS.length;
    onChange(HORIZONS[next]);
    btnRefs.current[next]?.focus();
  };

  return (
    <div className="sbd-when" ref={railRef} role="tablist" aria-label="When">
      {HORIZONS.map((h, i) => {
        const on = h === horizon;
        return (
          <button
            key={h}
            ref={(el) => {
              btnRefs.current[i] = el;
            }}
            type="button"
            role="tab"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            className="sbd-when__tab"
            onClick={() => onChange(h)}
            onKeyDown={(e) => {
              if (e.key === "ArrowRight" || e.key === "ArrowDown") {
                e.preventDefault();
                move(i, 1);
              } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
                e.preventDefault();
                move(i, -1);
              } else if (e.key === "Home") {
                e.preventDefault();
                move(-1, 1);
              } else if (e.key === "End") {
                e.preventDefault();
                move(0, -1);
              }
            }}
          >
            <span className="sbd-when__name">{HORIZON_PILL[h]}</span>
            <span className="sbd-sr-only">, </span>
            <span className="sbd-when__date">{horizonDateLine(h, nowMs)}</span>
          </button>
        );
      })}
    </div>
  );
}
