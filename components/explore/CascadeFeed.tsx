"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import Link from "next/link";
import { ListCard, PickCard, EmptyState, SBIcon } from "@/components/ui";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Thing } from "@/lib/things";
import type { Weather } from "@/lib/weather";
import type { Horizon } from "@/lib/explore";
import { dedupeFeedVenuePhotos, type PoolPhoto } from "@/lib/venuePool";
import { cardBlurb, cardFacts, cardPlace, cardVisual, heroEyebrow, heroTime, isGrayDay } from "./derive";
import { RockGrid } from "./RockTile";
import { LeadDayRail } from "./LeadDayRail";

const HORIZON_LABEL: Record<Horizon, string> = {
  today: "Happening Today",
  week: "Happening This Week",
  month: "Happening This Month",
};

// Home Rework spec §12, the R1 ribbon label maps to the current horizon.
const PICK_RIBBON_LABEL: Record<Horizon, string> = {
  today: "Today's pick",
  week: "This week's pick",
  month: "This month's pick",
};

// W1.3b Layer 2, the pick's last-resort parachute when the published pool has
// zero evergreen things (cold DB / upstream fetch failure). Hardcoded because
// it's the safety net, not content; no save heart, not a DB row.
const STATIC_FALLBACK = {
  eyebrow: "Always worth it",
  title: "The Courthouse clock tower",
  line: "The best free view in town, hand-painted ceilings on the way up, the whole city and the sea at the top.",
  href: "/discover",
};

/** Home Rework spec §12, the elevated "Today's pick" (R1), atop the lead
 *  section. Sponsor-blind: `pick` is chosen upstream (ExploreClient) purely from
 *  the founder pin / pickAutoHero / evergreen-fallback chain, never from
 *  sponsor/featured status. Ribbon is decorative; the card's accessible name is
 *  still just the title (PickCard's stretched link), same as every other card. */
function TodayPick({
  pick,
  isFallback,
  isStatic,
  horizon,
  weather,
}: {
  pick: Thing | null;
  isFallback: boolean;
  isStatic: boolean;
  horizon: Horizon;
  weather: Weather | null;
}) {
  const ribbonLabel = PICK_RIBBON_LABEL[horizon];

  if (isStatic) {
    return (
      <article className="sbd-card sbd-pick sbd-pick--static">
        <span className="sbd-pick__ribbon" aria-hidden="true">
          <span className="sbd-pick__ribbon-star">★</span>
          {ribbonLabel}
        </span>
        <div className="sbd-pick__body sbd-pick__body--static">
          <div className="sbd-pick__eyebrow">{STATIC_FALLBACK.eyebrow}</div>
          <h3 className="sbd-pick__title">
            <Link href={STATIC_FALLBACK.href} className="sbd-stretch">
              {STATIC_FALLBACK.title}
            </Link>
          </h3>
          <div className="sbd-pick__meta">{STATIC_FALLBACK.line}</div>
        </div>
      </article>
    );
  }

  if (!pick) return null;

  const meta = [cardPlace(pick), heroTime(pick)].filter(Boolean).join(" · ");
  const contextEyebrow = isFallback
    ? "Nothing matches that exactly today, but this is always worth it."
    : heroEyebrow(pick, isGrayDay(weather));

  return (
    <PickCard
      id={pick.id}
      href={`/thing/${pick.id}`}
      title={pick.title}
      blurb={cardBlurb(pick)}
      occasionKey={pick.tags[0]}
      meta={meta || undefined}
      contextEyebrow={contextEyebrow}
      ribbonLabel={ribbonLabel}
      photo={pick.photo_url ?? undefined}
      tone="gold"
    />
  );
}

function deriveLeadDek(horizon: Horizon, count: number): string | null {
  if (horizon === "today") {
    if (count === 0) return null;
    return count <= 4 ? "A quieter day, worth a look." : "Plenty on today.";
  }
  if (horizon === "week") return "The week ahead in Santa Barbara.";
  return "The month worth building a day around.";
}

// Today opens in the standard left-rail ListCard format, the top-banner
// feature-lead was retired so the hero pick is the sole marquee (spec §2.1).
function TodayLead({ tier1 }: { tier1: Thing[] }) {
  return (
    <div className="sbd-feed-section__list">
      {tier1.map((t, i) => (
        <div
          key={t.id}
          className="sbd-reveal"
          style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
        >
          <ListCard
            id={t.id}
            href={`/thing/${t.id}`}
            occasionKey={t.tags[0]}
            title={t.title}
            blurb={cardBlurb(t)}
            when={cardFacts(t).join(" · ")}
            photo={t.photo_url ?? undefined}
            visual={cardVisual(t)}
          />
        </div>
      ))}
    </div>
  );
}

function LeadSection({
  tier1,
  horizon,
  monthShownCount,
  onMonthShowMore,
  pick,
  pickIsFallback,
  pickIsStatic,
  weather,
}: {
  tier1: Thing[];
  horizon: Horizon;
  monthShownCount: number;
  onMonthShowMore: () => void;
  pick: Thing | null;
  pickIsFallback: boolean;
  pickIsStatic: boolean;
  weather: Weather | null;
}) {
  return (
    <section className="sbd-feed-section">
      <SectionHeader
        mode="lead"
        label={HORIZON_LABEL[horizon]}
        dek={deriveLeadDek(horizon, tier1.length)}
        sticky={horizon === "today"}
      />
      {pick || pickIsStatic ? (
        <TodayPick
          pick={pick}
          isFallback={pickIsFallback}
          isStatic={pickIsStatic}
          horizon={horizon}
          weather={weather}
        />
      ) : null}
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

export function CascadeFeed({
  items: rawItems,
  horizon,
  pick = null,
  pickIsFallback = false,
  pickIsStatic = false,
  weather = null,
  onClearFilters,
  hasActiveFilters = false,
  onShowClosestMatches,
  venuePools,
}: {
  items: Thing[];
  horizon: Horizon;
  /** Home Rework spec §12, the elevated "Today's pick" (R1), sponsor-blind,
   *  computed upstream in ExploreClient. Excluded from `items` below so it never
   *  double-renders. */
  pick?: Thing | null;
  /** W1.3b Layer 1, `pick` is a deterministic evergreen fallback, not a real match. */
  pickIsFallback?: boolean;
  /** W1.3b Layer 2, no thing at all; render the hardcoded static parachute card. */
  pickIsStatic?: boolean;
  weather?: Weather | null;
  onClearFilters?: () => void;
  /** Home Rework spec §11.4, at least one of Place/Vibe/Activity is active, so an
   *  empty result gets the stacked-filter empty state (two recovery actions)
   *  instead of the generic one. */
  hasActiveFilters?: boolean;
  /** Drops the most-recently-added filter (repeatedly, if needed) until something
   *  shows, or all filters are gone. Required when `hasActiveFilters` is true. */
  onShowClosestMatches?: () => void;
  /** Card Imagery Build Spec Phase 2 §5.4, approved venue photo pools, keyed by
   *  venue_id. Optional: callers that don't pass one (there are none left, but the
   *  type stays permissive) simply skip the per-feed dedupe pass. */
  venuePools?: Record<string, PoolPhoto[]>;
}) {
  const [tier2Open, setTier2Open] = useState(false);
  const [tier3Open, setTier3Open] = useState(false);
  const [monthShownCount, setMonthShownCount] = useState(8);
  const feedRef = useRef<HTMLDivElement>(null);
  const onMonthShowMore = useCallback(() => setMonthShownCount((c) => c + 8), []);

  // §5.4, walk THIS render's feed order and de-repeat a venue's pool photo across
  // same-day siblings (e.g. three SOhO events sharing one ingest-time hash
  // collision); falls to the gradient once a venue's pool is exhausted this render.
  // Every downstream section (TodayLead, LeadDayRail, RockGrid, tier2/3 lists) reads
  // from this single deduped array, so the pass only needs to run once, here.
  const items = useMemo(
    () => (venuePools ? dedupeFeedVenuePhotos(rawItems, venuePools) : rawItems),
    [rawItems, venuePools],
  );

  // Reset collapsed state and pagination on horizon change
  useEffect(() => {
    setMonthShownCount(8);
    setTier2Open(false);
    setTier3Open(false);
  }, [horizon]);

  // Reveal stagger, IntersectionObserver adds .is-in; skipped under reduced-motion
  useEffect(() => {
    const el = feedRef.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) return;
    const nodes = Array.from(el.querySelectorAll<HTMLElement>(".sbd-reveal"));
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08 },
    );
    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
    // monthShownCount: "See more" mounts fresh .sbd-reveal nodes (Month pagination)
    // that this effect must re-scan for, or they'd sit at opacity:0 forever.
  }, [items, tier2Open, tier3Open, monthShownCount]);

  const tier1 = items.filter((t) => t.happening_tier === 1);
  const tier2 = items.filter((t) => t.happening_tier === 2);
  const tier3 = items.filter((t) => t.happening_tier === 3);
  const hasLead = tier1.length > 0 || pick != null || pickIsStatic;

  if (tier1.length === 0 && tier2.length === 0 && tier3.length === 0 && !hasLead) {
    return (
      <div style={{ marginTop: "var(--space-6)" }}>
        <div className="sbd-sr-only" aria-live="polite">
          0 things found
        </div>
        <EmptyState
          icon={<SBIcon name="reset" size={28} stroke="var(--sage)" />}
          message={
            hasActiveFilters
              ? "Nothing matches all of those. Try loosening one."
              : "Nothing matches that combination. Try a wider time or a different vibe."
          }
          action={
            hasActiveFilters ? (
              <div className="sbd-empty__actions">
                {onShowClosestMatches ? (
                  <button
                    type="button"
                    className="sbd-empty__reset"
                    onClick={onShowClosestMatches}
                  >
                    Show the closest matches
                  </button>
                ) : null}
                {onClearFilters ? (
                  <button
                    type="button"
                    className="sbd-empty__reset sbd-empty__reset--ghost"
                    onClick={onClearFilters}
                  >
                    Clear filters
                  </button>
                ) : null}
              </div>
            ) : onClearFilters ? (
              <button
                type="button"
                className="sbd-empty__reset"
                onClick={onClearFilters}
              >
                Show everything
              </button>
            ) : undefined
          }
        />
      </div>
    );
  }

  const totalCount = tier1.length + tier2.length + tier3.length + (pick ? 1 : 0);

  return (
    <div ref={feedRef}>
      <div className="sbd-sr-only" aria-live="polite">
        {totalCount} {totalCount === 1 ? "thing" : "things"} found
      </div>
      {hasLead && (
        <LeadSection
          tier1={tier1}
          horizon={horizon}
          monthShownCount={monthShownCount}
          onMonthShowMore={onMonthShowMore}
          pick={pick}
          pickIsFallback={pickIsFallback}
          pickIsStatic={pickIsStatic}
          weather={weather}
        />
      )}

      {/* Build your day CTA, Today only */}
      {horizon === "today" && (
        <Link href="/plan" className="sbd-build-cta" aria-label="Build your day">
          <div className="sbd-build-cta__icon" aria-hidden="true">
            <SBIcon name="sun" size={22} stroke="#fff" strokeWidth={1.8} />
          </div>
          <div className="sbd-build-cta__body">
            <span className="sbd-build-cta__title">Build your day</span>
            <span className="sbd-build-cta__sub">
              Tell us the shape, we&rsquo;ll draft it, you tweak it.
            </span>
          </div>
          <span className="sbd-build-cta__arrow" aria-hidden="true">→</span>
        </Link>
      )}

      {/* Every week, Tier 2, collapsed by default */}
      {tier2.length > 0 && (
        <section className="sbd-feed-section">
          <SectionHeader
            mode="collapsible"
            label="Every week"
            count={tier2.length}
            expanded={tier2Open}
            onToggle={() => setTier2Open((o) => !o)}
            controlsId="explore-tier2"
          />
          <div id="explore-tier2" hidden={!tier2Open}>
            <div className="sbd-feed-section__list sbd-feed-section__list--inner">
              {tier2.map((t, i) => (
                <div
                  key={t.id}
                  className="sbd-reveal"
                  style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
                >
                  <ListCard
                    id={t.id}
                    href={`/thing/${t.id}`}
                    occasionKey={t.tags[0]}
                    title={t.title}
                    blurb={cardBlurb(t)}
                    when={cardFacts(t).join(" · ")}
                    photo={t.photo_url ?? undefined}
                    visual={cardVisual(t)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Anytime in SB, Tier 3, collapsed by default */}
      {tier3.length > 0 && (
        <section className="sbd-feed-section">
          <SectionHeader
            mode="collapsible"
            label="Anytime in SB"
            count={tier3.length}
            expanded={tier3Open}
            onToggle={() => setTier3Open((o) => !o)}
            controlsId="explore-tier3"
          />
          <div id="explore-tier3" hidden={!tier3Open}>
            <div className="sbd-feed-section__list sbd-feed-section__list--inner">
              {tier3.map((t, i) => (
                <div
                  key={t.id}
                  className="sbd-reveal"
                  style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
                >
                  <ListCard
                    id={t.id}
                    href={`/thing/${t.id}`}
                    occasionKey={t.tags[0]}
                    title={t.title}
                    blurb={cardBlurb(t)}
                    when={cardFacts(t).join(" · ")}
                    photo={t.photo_url ?? undefined}
                    visual={cardVisual(t)}
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
