"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useItineraries } from "@/lib/plan/itineraries";
import { shortStamp } from "@/lib/plan/dates";
import { BLOCK_LABEL } from "@/lib/plan/labels";
import { trackEvent } from "@/lib/analytics";
import type { SharedPlanPayload, Block } from "@/lib/plan/types";

const BLOCK_NODE: Record<Block, { glyph: string; color: string }> = {
  morning:   { glyph: "🌅", color: "var(--tod-morning)" },
  afternoon: { glyph: "⛅", color: "var(--tod-afternoon)" },
  night:     { glyph: "🌙", color: "var(--tod-night)" },
};

// Format a real startsAt ISO datetime as a clock time in SB local time (Rule 3).
function formatClockTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(new Date(iso));
}

export function SharedPlanView({ payload }: { payload: SharedPlanPayload }) {
  const { save } = useItineraries();
  const [saved, setSaved] = useState(false);

  // Event 4: a shared plan was opened (fires on mount; count is stable here).
  useEffect(() => {
    trackEvent("share_open", { kind: "plan", count: payload.stops.length });
  }, [payload.stops.length]);

  function handleSave() {
    if (saved) return;
    // Derive unique periods from stops in order.
    const seenBlocks = new Set<Block>();
    const periods: Block[] = [];
    for (const s of payload.stops) {
      if (!seenBlocks.has(s.block)) {
        seenBlocks.add(s.block);
        periods.push(s.block);
      }
    }
    save({
      title: payload.title,
      answers: {
        dateISO: payload.dateISO,
        periods: periods.length ? periods : ["morning"],
        who: "friends",
        vibes: [],
        zone: null,
      },
      stops: payload.stops.map((s) => ({
        id: Math.random().toString(36).slice(2, 9),
        block: s.block,
        thingId: s.thingId,
        fromSaved: false,
        fromDraft: false,
      })),
    });
    setSaved(true);
  }

  const stopCount = payload.stops.length;
  const dateLabel = shortStamp(payload.dateISO);

  return (
    <div className="sbd-shplan">
      <a href="#main" className="sbd-skip">Skip to content</a>
      {/* Sticky header */}
      <header className="sbd-shplan__hd">
        <div className="sbd-shplan__hd-inner">
          <Link href="/plan" className="sbd-shplan__brand" aria-label="SB Daymaker, make your own day">
            <span className="sbd-shplan__mark" aria-hidden="true">SB</span>
            <span className="sbd-shplan__wordmark">Daymaker</span>
          </Link>
          <span className="sbd-shplan__lock" aria-label="View-only shared plan">
            🔒 View-only
          </span>
        </div>
      </header>

      {/* Scrollable body */}
      <main id="main" className="sbd-shplan__body">
        {/* Hero */}
        <div className="sbd-shplan__hero">
          <p className="sbd-shplan__eyebrow">Shared with you</p>
          <h1 className="sbd-shplan__title">{payload.title}</h1>
          <p className="sbd-shplan__meta">
            {dateLabel} · {stopCount} {stopCount === 1 ? "stop" : "stops"}
          </p>
        </div>

        {/* Read-only spine */}
        <div className="sbd-spine">
          <div className="sbd-spine__rail" aria-hidden="true" />
          {payload.stops.map((s, idx) => {
            // Safe fallback for old payload blocks ('evening'/'late'/'midday') from stored data.
            const safeBlock: Block =
              s.block === ("evening" as string) || s.block === ("late" as string)
                ? "night"
                : s.block === ("midday" as string)
                  ? "afternoon"
                  : s.block;
            const node = BLOCK_NODE[safeBlock] ?? BLOCK_NODE.morning;
            // Rule 3: show clock time only if startsAt is present.
            const timeStr = s.startsAt ? formatClockTime(s.startsAt) : null;
            const blockLabel = s.blockLabel ?? BLOCK_LABEL[safeBlock];

            return (
              <div key={idx} className="sbd-stop">
                <div
                  className="sbd-node"
                  style={{ background: node.color }}
                  aria-hidden="true"
                >
                  {node.glyph}
                </div>
                <div className="sbd-rcard">
                  {s.photo_url ? (
                    <img
                      className="sbd-rcard__thumb"
                      src={s.photo_url}
                      alt=""
                      loading="lazy"
                    />
                  ) : (
                    <div className="sbd-rcard__thumb sbd-media--sage" aria-hidden="true" />
                  )}
                  <div className="sbd-rcard__body">
                    {/* Show section label; add clock time only if real */}
                    <span className="sbd-rcard__eb">
                      {timeStr ? `${blockLabel} · ${timeStr}` : blockLabel}
                    </span>
                    <h2 className="sbd-rcard__nm">{s.title}</h2>
                    <span className="sbd-rcard__mt">
                      {s.area}
                      {s.blurb ? ` · ${s.blurb}` : ""}
                    </span>
                  </div>
                  <Link
                    href={`/thing/${s.thingId}`}
                    className="sbd-rcard__det"
                    aria-label={`Details for ${s.title}`}
                  >
                    Details ›
                  </Link>
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ height: "120px" }} />
      </main>

      {/* Sticky footer */}
      <div className="sbd-shplan__foot">
        {saved ? (
          <p className="sbd-shplan__saved">✓ Saved to your Days, find it in Saved › Days.</p>
        ) : (
          <button
            type="button"
            className="sbd-btn sbd-btn--primary sbd-shplan__savebtn"
            onClick={handleSave}
          >
            ❤️ Save this plan
          </button>
        )}
        <Link href="/plan" className="sbd-shplan__footlink">
          Make your own day in SB Daymaker →
        </Link>
      </div>
    </div>
  );
}
