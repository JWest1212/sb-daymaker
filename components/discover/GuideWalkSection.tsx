"use client";

import { useCallback, useRef, useState } from "react";
import { useSaves } from "@/components/saves/SavesProvider";
import type { GuideContent, GuideChapter } from "@/lib/guides";
import { getGuideArt } from "@/lib/guide-art";

// ─── Types ────────────────────────────────────────────────────────────────

export interface StopDisplay {
  position: number;
  chapter: number;
  label: string;
  note: string | null;
  thing_id: string | null;
  sub: string | null;         // derived by server (deriveStopSub)
  directionsUrl: string | null; // derived by server (directionsUrl)
}

interface Props {
  artId: string | null;
  stops: StopDisplay[];
  chapters: GuideChapter[];
  asides: GuideContent["asides"];
  stopCount: number;
}

// ─── Time-of-day helper ──────────────────────────────────────────────────

function nowTodBand(): "morning" | "afternoon" | "golden" | "evening" {
  const h = new Date().getHours();
  if (h < 11) return "morning";
  if (h < 17) return "afternoon";
  if (h < 20) return "golden";
  return "evening";
}

// ─── Stop card ────────────────────────────────────────────────────────────

function StopCard({
  stop,
  isLast,
}: {
  stop: StopDisplay;
  isLast: boolean;
}) {
  const { isSaved, toggle } = useSaves();
  const saved = stop.thing_id ? isSaved(stop.thing_id) : false;

  return (
    <div className={`sbd-gd-stop${isLast ? " sbd-gd-stop--last" : ""}`}>
      <div className="sbd-gd-stopmarker">
        <span className="sbd-gd-stopnum">{stop.position}</span>
      </div>
      <div className="sbd-gd-stopbody">
        <div className="sbd-gd-stoptoprow">
          <div className="sbd-gd-stoplabelwrap">
            <h4 className="sbd-gd-stoplabel">{stop.label}</h4>
            {(stop.sub || stop.directionsUrl) && (
              <div className="sbd-gd-stopsub">
                {stop.sub}
                {stop.directionsUrl && (
                  <a
                    href={stop.directionsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="sbd-gd-dir"
                    aria-label={`Directions to ${stop.label}`}
                  >
                    ⌖ DIRECTIONS
                  </a>
                )}
              </div>
            )}
          </div>
          <div className="sbd-gd-stopctrls">
            {/* ✓ Been button — disabled/static in Phase 2 */}
            <button
              type="button"
              className="sbd-gd-beenbtn"
              disabled
              aria-label={`Mark ${stop.label} as been`}
            >
              ✓ Been
            </button>
            {/* heart save — only for thing-backed stops */}
            {stop.thing_id && (
              <button
                type="button"
                className={`sbd-gd-heart${saved ? " sbd-gd-heart--saved" : ""}`}
                aria-label={saved ? `Saved ${stop.label}` : `Save ${stop.label}`}
                aria-pressed={saved}
                onClick={() => toggle(stop.thing_id!)}
              >
                <svg viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M12 20s-7-4.6-7-10a4 4 0 017-2.6A4 4 0 0119 10c0 5.4-7 10-7 10z" />
                </svg>
              </button>
            )}
          </div>
        </div>
        {stop.note && <p className="sbd-gd-stopnote">{stop.note}</p>}
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────

export function GuideWalkSection({ artId, stops, chapters, asides, stopCount }: Props) {
  const art = getGuideArt(artId);
  const plateRef = useRef<HTMLDivElement>(null);
  const chapterRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const todBand = nowTodBand();

  // open chapters (1-based chapter numbers)
  const [openChapters, setOpenChapters] = useState<Set<number>>(new Set());
  const [showHint, setShowHint] = useState(true);

  const toggleChapter = useCallback((ch: number) => {
    setShowHint(false);
    setOpenChapters((prev) => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  }, []);

  const scrollToChapter = useCallback((ch: number) => {
    setOpenChapters((prev) => {
      const next = new Set(prev);
      next.add(ch);
      return next;
    });
    // scroll after state update
    requestAnimationFrame(() => {
      chapterRefs.current[ch]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const scrollToPlate = useCallback(() => {
    plateRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  // Group stops by chapter
  const stopsByChapter = stops.reduce<Record<number, StopDisplay[]>>((acc, s) => {
    (acc[s.chapter] ??= []).push(s);
    return acc;
  }, {});

  // Asides by after_chapter
  const asidesByChapter = asides.reduce<Record<number, string[]>>((acc, a) => {
    if (a.after_chapter != null && a.text) {
      (acc[a.after_chapter] ??= []).push(a.text);
    }
    return acc;
  }, {});

  // Derive a stop-position → chapter map for marker tap
  const posToChapter = stops.reduce<Record<number, number>>((acc, s) => {
    acc[s.position] = s.chapter;
    return acc;
  }, {});

  return (
    <>
      {/* sketch plate -------------------------------------------------- */}
      <div id="sbd-gd-plate" className="sbd-gd-plate" ref={plateRef}>
        {art ? (
          <div style={{ position: "relative" }}>
            <art.Component />
            {/* marker overlay */}
            <svg
              viewBox="0 0 360 330"
              className="sbd-gd-markersvg"
              style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
              aria-hidden="true"
            >
              <g
                fontFamily="var(--font-mono)"
                fontSize="11"
                fontWeight="700"
                textAnchor="middle"
              >
                {Object.entries(art.markers).map(([posStr, { x, y }]) => {
                  const pos = Number(posStr);
                  const ch = posToChapter[pos] ?? 1;
                  return (
                    <g key={pos} className="sbd-gd-marker-btn" onClick={() => scrollToChapter(ch)} role="button" tabIndex={0} aria-label={`Jump to stop ${pos}`} onKeyDown={(e) => e.key === "Enter" && scrollToChapter(ch)}>
                      <circle cx={x} cy={y} r="13" fill="var(--paper)" />
                      <circle cx={x} cy={y} r="10.5" fill="var(--terracotta)" />
                      <text x={x} y={y + 4} fill="var(--paper)">{pos}</text>
                    </g>
                  );
                })}
              </g>
            </svg>
          </div>
        ) : (
          <div style={{ height: 200, background: "var(--plaster-2)", borderRadius: "var(--radius-sm)" }} aria-hidden="true" />
        )}
        <div className="sbd-gd-sketchcap">
          <span>TAP A NUMBER TO JUMP</span>
          <span>MARKED STOPS TURN SAGE</span>
        </div>
      </div>

      {/* walk header --------------------------------------------------- */}
      <div className="sbd-gd-walkhead">
        <h3 className="sbd-gd-walkhead__h3">The walk</h3>
        <p className="sbd-gd-walkhead__desc">
          Tracks to sand, in order. Tap a chapter to open it, mark stops <b>✓ Been</b>, and {stopCount} marks press the stamp.
        </p>
      </div>

      {/* chapter accordion + asides ------------------------------------ */}
      {chapters.map((ch, idx) => {
        const chNum = idx + 1;
        const isOpen = openChapters.has(chNum);
        const chStops = stopsByChapter[chNum] ?? [];
        const chAsides = asidesByChapter[chNum] ?? [];
        const isNow = ch.tod === todBand;

        return (
          <div key={chNum} style={idx === 0 ? { position: "relative" } : undefined}>
            {idx === 0 && showHint && (
              <div className="sbd-gd-chaphint" aria-hidden="true">
                Click to discover these stops
              </div>
            )}
            <button
              ref={(el) => { chapterRefs.current[chNum] = el; }}
              type="button"
              className="sbd-gd-chband"
              aria-expanded={isOpen}
              style={{ scrollMarginTop: 60 }}
              onClick={() => toggleChapter(chNum)}
            >
              <div className="sbd-gd-chband__body">
                <div className="sbd-gd-chband__k">
                  {ch.k}
                  {isNow && <span className="sbd-gd-chband__now">Now</span>}
                </div>
                <div className="sbd-gd-chband__nm">{ch.name}</div>
                <div className="sbd-gd-chband__sum">{ch.sum}</div>
              </div>
              <span className="sbd-gd-chband__been">✓ 0/{chStops.length}</span>
              <span className="sbd-gd-chband__chev" aria-hidden="true">{isOpen ? "▴" : "▾"}</span>
            </button>

            {isOpen && (
              <div className="sbd-gd-chinner">
                {chStops.map((s, i) => (
                  <StopCard
                    key={s.position}
                    stop={s}
                    isLast={i === chStops.length - 1}
                  />
                ))}
              </div>
            )}

            {/* asides after this chapter */}
            {chAsides.map((text, ai) => (
              <aside key={ai} className="sbd-gd-aside">
                <div className="sbd-gd-aside__eyebrow">From a local</div>
                <p className="sbd-gd-aside__body">{text}</p>
              </aside>
            ))}
          </div>
        );
      })}

      {/* ⌖ Sketch pill ------------------------------------------------- */}
      <button
        type="button"
        className="sbd-gd-pill"
        onClick={scrollToPlate}
        aria-label="Scroll to sketch map"
      >
        ⌖ Sketch
      </button>
    </>
  );
}
