"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PickCard, ListCard, EmptyState } from "@/components/ui";
import type { Thing } from "@/lib/things";
import type { Horizon } from "@/lib/explore";
import {
  cardBlurb,
  cardFacts,
  cardPlace,
  cardTone,
} from "./derive";
import { formatWhen } from "@/lib/explore";
import { RockGrid } from "./RockTile";
import { LeadDayRail } from "./LeadDayRail";

const HORIZON_LABEL: Record<Horizon, string> = {
  today: "Happening Today",
  week:  "Happening This Week",
  month: "Happening This Month",
};

// ---------------------------------------------------------------------------
// Today branch — first item is the feature PickCard; rest are ListCard briefs.
// Phase 4 (B4) formalises lead+briefs split; for now all render as PickCard.
// ---------------------------------------------------------------------------
function TodayLead({ tier1 }: { tier1: Thing[] }) {
  return (
    <div className="sbd-feed-section__list">
      {tier1.map((t, i) => (
        <PickCard
          key={t.id}
          id={t.id}
          href={`/thing/${t.id}`}
          tone={cardTone(i)}
          occasionKey={t.tags[0]}
          place={cardPlace(t)}
          title={t.title}
          blurb={cardBlurb(t)}
          facts={cardFacts(t)}
          when={formatWhen(t.starts_at, t.ends_at) ?? undefined}
          photo={t.photo_url ?? undefined}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeadSection — horizon-aware switch
// ---------------------------------------------------------------------------
function LeadSection({
  tier1,
  horizon,
  monthShownCount,
  onMonthShowMore,
}: {
  tier1: Thing[];
  horizon: Horizon;
  monthShownCount: number;
  onMonthShowMore: () => void;
}) {
  return (
    <section className="sbd-feed-section">
      <div className="sbd-sh sbd-sh--static">
        <span className="sbd-sh__icon" aria-hidden="true">📅</span>
        <h2 className="sbd-sh__label">{HORIZON_LABEL[horizon]}</h2>
        <span className="sbd-sh__badge" aria-label={`${tier1.length} items`}>
          {tier1.length}
        </span>
      </div>
      {horizon === "today" && <TodayLead tier1={tier1} />}
      {horizon === "week" && <LeadDayRail items={tier1} />}
      {horizon === "month" && (
        <div className="sbd-feed-section__list">
          <RockGrid
            items={tier1}
            shownCount={monthShownCount}
            onShowMore={onMonthShowMore}
          />
        </div>
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// CascadeFeed — tier partition + section orchestration
// ---------------------------------------------------------------------------
export function CascadeFeed({ items, horizon }: { items: Thing[]; horizon: Horizon }) {
  const [tier2Open, setTier2Open] = useState(false);
  const [tier3Open, setTier3Open] = useState(false);
  const [monthShownCount, setMonthShownCount] = useState(8);

  useEffect(() => {
    setMonthShownCount(8);
  }, [horizon]);

  const tier1 = items.filter((t) => t.happening_tier === 1);
  const tier2 = items.filter((t) => t.happening_tier === 2);
  const tier3 = items.filter((t) => t.happening_tier === 3);

  if (tier1.length === 0 && tier2.length === 0 && tier3.length === 0) {
    return (
      <div style={{ marginTop: "var(--space-6)" }}>
        <EmptyState
          icon="🔍"
          message="Nothing matches that combination right now. Try another vibe or a wider time horizon."
        />
      </div>
    );
  }

  function renderListCard(t: Thing) {
    return (
      <ListCard
        key={t.id}
        id={t.id}
        href={`/thing/${t.id}`}
        occasionKey={t.tags[0]}
        title={t.title}
        blurb={cardBlurb(t)}
        when={cardFacts(t).join(" · ")}
        photo={t.photo_url ?? undefined}
      />
    );
  }

  return (
    <>
      {/* Lead section — Tier 1, always open, layout switches on horizon */}
      {tier1.length > 0 && (
        <LeadSection
          tier1={tier1}
          horizon={horizon}
          monthShownCount={monthShownCount}
          onMonthShowMore={() => setMonthShownCount((c) => c + 8)}
        />
      )}

      {/* Build your day CTA — always visible, between lead and collapsed sections */}
      <Link href="/plan" className="sbd-build-cta" aria-label="Build your day">
        <div className="sbd-build-cta__icon" aria-hidden="true">☀️</div>
        <div className="sbd-build-cta__body">
          <span className="sbd-build-cta__title">Build your day</span>
          <span className="sbd-build-cta__sub">
            Tell us the shape — we&rsquo;ll draft it, you tweak it.
          </span>
        </div>
        <span className="sbd-build-cta__arrow" aria-hidden="true">→</span>
      </Link>

      {/* Recurring Weekly — Tier 2, collapsed by default */}
      {tier2.length > 0 && (
        <section className="sbd-feed-section">
          <button
            type="button"
            className="sbd-sh"
            aria-expanded={tier2Open}
            aria-controls="explore-tier2"
            onClick={() => setTier2Open((o) => !o)}
          >
            <span className="sbd-sh__icon" aria-hidden="true">🔁</span>
            <span className="sbd-sh__label">Happening this day each week</span>
            <span className="sbd-sh__badge" aria-label={`${tier2.length} items`}>
              {tier2.length}
            </span>
            <span
              className={`sbd-sh__chev${tier2Open ? " sbd-sh__chev--open" : ""}`}
              aria-hidden="true"
            >
              ⌄
            </span>
          </button>
          <div id="explore-tier2" hidden={!tier2Open}>
            <div className="sbd-feed-section__list sbd-feed-section__list--inner">
              {tier2.map((t) => renderListCard(t))}
            </div>
          </div>
        </section>
      )}

      {/* Great any time — Tier 3, collapsed by default */}
      {tier3.length > 0 && (
        <section className="sbd-feed-section">
          <button
            type="button"
            className="sbd-sh"
            aria-expanded={tier3Open}
            aria-controls="explore-tier3"
            onClick={() => setTier3Open((o) => !o)}
          >
            <span className="sbd-sh__icon" aria-hidden="true">⭐</span>
            <span className="sbd-sh__label">Great any day</span>
            <span className="sbd-sh__badge" aria-label={`${tier3.length} items`}>
              {tier3.length}
            </span>
            <span
              className={`sbd-sh__chev${tier3Open ? " sbd-sh__chev--open" : ""}`}
              aria-hidden="true"
            >
              ⌄
            </span>
          </button>
          <div id="explore-tier3" hidden={!tier3Open}>
            <div className="sbd-feed-section__list sbd-feed-section__list--inner">
              {tier3.map((t) => renderListCard(t))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
