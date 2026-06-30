"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PickCard, ListCard, EmptyState } from "@/components/ui";
import type { Thing } from "@/lib/things";
import type { Horizon } from "@/lib/explore";
import { useSaves } from "@/components/saves/SavesProvider";
import { shareUrl } from "@/components/saved/share";
import {
  cardBlurb,
  cardFacts,
  cardPlace,
  cardTag,
  cardTagColor,
  cardTone,
} from "./derive";
import { RockGrid } from "./RockTile";
import { LeadDayRail } from "./LeadDayRail";

const HORIZON_LABEL: Record<Horizon, string> = {
  today: "Happening Today",
  week:  "Happening This Week",
  month: "Happening This Month",
};

// ---------------------------------------------------------------------------
// Shared card-handler types passed through the component tree
// ---------------------------------------------------------------------------
type CardHandlers = {
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
  handleShare: (t: Thing) => void;
};

// ---------------------------------------------------------------------------
// Today branch — PickCard stack (the existing live layout, unchanged)
// ---------------------------------------------------------------------------
function TodayLead({ tier1, isSaved, toggle, handleShare }: { tier1: Thing[] } & CardHandlers) {
  return (
    <div className="sbd-feed-section__list">
      {tier1.map((t, i) => (
        <PickCard
          key={t.id}
          href={`/thing/${t.id}`}
          tone={cardTone(i)}
          tag={cardTag(t)}
          place={cardPlace(t)}
          title={t.title}
          blurb={cardBlurb(t)}
          facts={cardFacts(t)}
          photo={t.photo_url ?? undefined}
          saved={isSaved(t.id)}
          onToggleSave={() => toggle(t.id)}
          onShare={() => handleShare(t)}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeadSection — horizon-aware switch; Today is live, Week/Month are TEMP stubs
// (replaced in Phases 3 and 2 respectively).
// ---------------------------------------------------------------------------
function LeadSection({
  tier1,
  horizon,
  monthShownCount,
  onMonthShowMore,
  isSaved,
  toggle,
  handleShare,
}: {
  tier1: Thing[];
  horizon: Horizon;
  monthShownCount: number;
  onMonthShowMore: () => void;
} & CardHandlers) {
  return (
    <section className="sbd-feed-section">
      <div className="sbd-sh sbd-sh--static">
        <span className="sbd-sh__icon" aria-hidden="true">📅</span>
        <h2 className="sbd-sh__label">{HORIZON_LABEL[horizon]}</h2>
        <span className="sbd-sh__badge" aria-label={`${tier1.length} items`}>
          {tier1.length}
        </span>
      </div>
      {horizon === "today" && (
        <TodayLead tier1={tier1} isSaved={isSaved} toggle={toggle} handleShare={handleShare} />
      )}
      {horizon === "week" && (
        <LeadDayRail items={tier1} isSaved={isSaved} toggle={toggle} handleShare={handleShare} />
      )}
      {horizon === "month" && (
        <div className="sbd-feed-section__list">
          <RockGrid
            items={tier1}
            shownCount={monthShownCount}
            onShowMore={onMonthShowMore}
            isSaved={isSaved}
            toggle={toggle}
            handleShare={handleShare}
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
  const { isSaved, toggle } = useSaves();
  const [tier2Open, setTier2Open] = useState(false);
  const [tier3Open, setTier3Open] = useState(false);
  const [monthShownCount, setMonthShownCount] = useState(8);

  // Reset month pagination when leaving Month horizon
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

  function handleShare(t: Thing) {
    const url = `${window.location.origin}/thing/${t.id}`;
    shareUrl(url, t.title);
  }

  function renderListCard(t: Thing, i: number) {
    return (
      <ListCard
        key={t.id}
        href={`/thing/${t.id}`}
        tone={cardTone(i)}
        tag={cardTag(t)}
        tagColor={cardTagColor(t)}
        title={t.title}
        blurb={cardBlurb(t)}
        meta={cardFacts(t).join(" · ")}
        photo={t.photo_url ?? undefined}
        saved={isSaved(t.id)}
        onToggleSave={() => toggle(t.id)}
        onShare={() => handleShare(t)}
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
          isSaved={isSaved}
          toggle={toggle}
          handleShare={handleShare}
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
              {tier2.map((t, i) => renderListCard(t, i))}
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
              {tier3.map((t, i) => renderListCard(t, i))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}
