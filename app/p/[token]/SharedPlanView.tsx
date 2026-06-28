"use client";

import { useState } from "react";
import Link from "next/link";
import { useItineraries } from "@/lib/plan/itineraries";
import { shortStamp } from "@/lib/plan/dates";
import type { SharedPlanPayload, Block, Period } from "@/lib/plan/types";

const BLOCK_NODE: Record<Block, { glyph: string; color: string }> = {
  morning: { glyph: "🌅", color: "var(--tod-morning)" },
  midday: { glyph: "☀️", color: "var(--tod-midday)" },
  afternoon: { glyph: "⛅", color: "var(--tod-afternoon)" },
  evening: { glyph: "🌆", color: "var(--tod-evening)" },
  night: { glyph: "🌙", color: "var(--tod-night)" },
};

function derivePeriods(stops: SharedPlanPayload["stops"]): Period[] {
  const seen = new Set<Period>();
  const out: Period[] = [];
  for (const s of stops) {
    if (s.block === "midday") continue;
    const p: Period = s.block === "night" ? "late" : (s.block as Period);
    if (!seen.has(p)) { seen.add(p); out.push(p); }
  }
  return out.length ? out : ["morning"];
}

export function SharedPlanView({ payload }: { payload: SharedPlanPayload }) {
  const { save } = useItineraries();
  const [saved, setSaved] = useState(false);

  function handleSave() {
    if (saved) return;
    const periods = derivePeriods(payload.stops);
    save({
      title: payload.title,
      shapeId: "daymaker",
      answers: {
        dateISO: payload.dateISO,
        periods,
        who: "friends",
        vibes: [],
        zone: null,
      },
      stops: payload.stops.map((s) => ({
        block: s.block,
        thingId: s.thingId,
        pinned: false,
        fromSaved: false,
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
          <Link href="/plan" className="sbd-shplan__brand" aria-label="SB Daymaker — make your own day">
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
          {payload.stops.map((s) => {
            const node = BLOCK_NODE[s.block];
            return (
              <div key={s.block} className="sbd-stop">
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
                    <span className="sbd-rcard__eb">{s.timeLabel}</span>
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
          <p className="sbd-shplan__saved">✓ Saved to your Days — find it in Saved › Days.</p>
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
