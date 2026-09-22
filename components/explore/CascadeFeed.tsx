"use client";

import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { thingPath } from "@/lib/seo/site";
import Link from "next/link";
import { ListCard, PickCard, EmptyState, SBIcon } from "@/components/ui";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Thing } from "@/lib/things";
import type { Weather } from "@/lib/weather";
import { collapseSeries, type Horizon } from "@/lib/explore";
import { dedupeFeedVenuePhotos, type PoolPhoto } from "@/lib/venuePool";
import { cardBlurb, cardFacts, cardPlace, cardVisual, heroEyebrow, heroTime, isGrayDay, recurringWhen, imageAlt, cardMeta, seriesMeta } from "./derive";
import { RockGrid } from "./RockTile";
import { LeadDayRail } from "./LeadDayRail";

const HORIZON_LABEL: Record<Horizon, string> = {
  today: "Happening Today",
  tomorrow: "Happening Tomorrow",
  weekend: "Happening This Weekend",
  next_weekend: "Happening Next Weekend",
  week: "Happening This Week",
  month: "Happening This Month",
};

// Home Rework spec §12, the R1 ribbon label maps to the current horizon.
const PICK_RIBBON_LABEL: Record<Horizon, string> = {
  today: "Today's pick",
  tomorrow: "Tomorrow's pick",
  weekend: "This weekend's pick",
  next_weekend: "Next weekend's pick",
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
  filteredEmpty,
  horizon,
  weather,
}: {
  pick: Thing | null;
  isFallback: boolean;
  isStatic: boolean;
  /** R1 W2.4 (EXP-017). True when the visitor's filter combination returns
   *  nothing. The pick itself is filter-independent, so this only changes what
   *  the card SAYS, never whether it appears. */
  filteredEmpty: boolean;
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
  // R1 W2.4. Two different situations that used to share one sentence. A
  // fallback pick means nothing DATED qualified today, which has nothing to do
  // with the visitor's filters; blaming the filters for it was simply wrong once
  // the pick stopped depending on them.
  const contextEyebrow = filteredEmpty
    ? "Nothing matches that exactly today, but this is always worth it."
    : isFallback
      ? "Nothing dated today, but this is always worth it."
      : heroEyebrow(pick, isGrayDay(weather));

  return (
    <PickCard
      id={pick.id}
      href={thingPath(pick)}
      title={pick.title}
      blurb={cardBlurb(pick)}
      occasionKey={pick.tags[0]}
      meta={meta || undefined}
      contextEyebrow={contextEyebrow}
      ribbonLabel={ribbonLabel}
      photo={pick.photo_url ?? undefined}
      photoAlt={imageAlt(pick)}
      tone="gold"
    />
  );
}

function deriveLeadDek(horizon: Horizon, count: number): string | null {
  if (horizon === "today") {
    if (count === 0) return null;
    return count <= 4 ? "A quieter day, worth a look." : "Plenty on today.";
  }
  if (horizon === "weekend") return "The weekend in Santa Barbara.";
  if (horizon === "week") return "The week ahead in Santa Barbara.";
  return "The month worth building a day around.";
}

// Today opens in the standard left-rail ListCard format, the top-banner
// feature-lead was retired so the hero pick is the sole marquee (spec §2.1).
function TodayLead({ tier1 }: { tier1: Thing[] }) {
  // R1 W6.4 (D6): one card per series, with the cadence and next date on the
  // meta line, instead of the same weekly thing repeated down the feed.
  const groups = collapseSeries(tier1);
  return (
    <div className="sbd-feed-section__list">
      {groups.map((g, i) => (
        <div
          key={g.lead.id}
          className="sbd-reveal"
          style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
        >
          <ListCard
            id={g.lead.id}
            href={thingPath(g.lead)}
            occasionKey={g.lead.tags[0]}
            title={g.lead.title}
            blurb={cardBlurb(g.lead)}
            when={
              g.occurrences.length > 1
                ? seriesMeta(g.lead, g.cadence, g.lead.starts_at)
                : cardMeta(g.lead)
            }
            dateCount={g.occurrences.length > 1 ? g.occurrences.length : undefined}
            photo={g.lead.photo_url ?? undefined}
            photoAlt={imageAlt(g.lead)}
            visual={cardVisual(g.lead)}
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
  filteredEmpty,
  weather,
}: {
  tier1: Thing[];
  horizon: Horizon;
  monthShownCount: number;
  onMonthShowMore: () => void;
  pick: Thing | null;
  pickIsFallback: boolean;
  pickIsStatic: boolean;
  filteredEmpty: boolean;
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
          filteredEmpty={filteredEmpty}
          horizon={horizon}
          weather={weather}
        />
      ) : null}
      {horizon === "today" && <TodayLead tier1={tier1} />}
      {/* G3.3, Weekend uses the same day-grouped rail as Week (multi-day dated). */}
      {(horizon === "week" || horizon === "weekend") && <LeadDayRail items={tier1} />}
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
  relaxedNote = null,
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
  /** R1 W4.2 (EXP-015). What "Show the closest matches" just relaxed, e.g.
   *  "Showing all areas". Null when nothing has been relaxed. */
  relaxedNote?: string | null;
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
  // R1 W6.9 (TP-B-05). A collapsed section is HIDDEN, not absent: `hidden` keeps
  // its cards in the DOM, and the browser fetches their photographs anyway. The
  // homepage was loading 69 images on arrival and 53 of them belonged to two
  // accordions nobody had opened, which is what held LCP out past 13 seconds.
  //
  // These latch on first open and never go back, so collapsing a section again
  // does not throw its cards away and make the next open refetch them.
  const [tier2Ever, setTier2Ever] = useState(false);
  const [tier3Ever, setTier3Ever] = useState(false);
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
    // The "ever opened" latches reset too: a different horizon is a different
    // set of cards, so keeping the old ones mounted would load photographs for
    // a section the visitor is not looking at.
    setTier2Ever(false);
    setTier3Ever(false);
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

  // R1 W2.4 (EXP-017). The feed is empty because of the visitor's filters, as
  // distinct from "nothing is on today". The pick renders either way; this only
  // decides which sentence is honest.
  const filteredEmpty = hasActiveFilters && tier1.length + tier2.length + tier3.length === 0;

  const totalCount = tier1.length + tier2.length + tier3.length + (pick ? 1 : 0);

  return (
    <div ref={feedRef}>
      <div className="sbd-sr-only" aria-live="polite">
        {totalCount} {totalCount === 1 ? "thing" : "things"} found
      </div>
      {/* R1 W4.2. Name the filter that was relaxed, so the feed changing after
          "Show the closest matches" is explained rather than just happening. */}
      {relaxedNote ? (
        <p className="sbd-relaxed" role="status">{relaxedNote}</p>
      ) : null}
      {hasLead && (
        <LeadSection
          tier1={tier1}
          horizon={horizon}
          monthShownCount={monthShownCount}
          onMonthShowMore={onMonthShowMore}
          pick={pick}
          pickIsFallback={pickIsFallback}
          pickIsStatic={pickIsStatic}
          filteredEmpty={filteredEmpty}
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
          {/* G3.4, recurring rhythms get their own section with a real computed
              next-date on each card ("Next: Fri Jul 24, 5pm"), never "every week". */}
          <SectionHeader
            mode="collapsible"
            label="Recurring in SB"
            count={tier2.length}
            expanded={tier2Open}
            onToggle={() => {
              setTier2Ever(true);
              setTier2Open((o) => !o);
            }}
            controlsId="explore-tier2"
          />
          {/* The container always exists, because aria-controls points at it. */}
          <div id="explore-tier2" hidden={!tier2Open}>
            <div className="sbd-feed-section__list sbd-feed-section__list--inner">
              {tier2Ever && tier2.map((t, i) => (
                <div
                  key={t.id}
                  className="sbd-reveal"
                  style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
                >
                  <ListCard
                    id={t.id}
                    href={thingPath(t)}
                    occasionKey={t.tags[0]}
                    title={t.title}
                    blurb={cardBlurb(t)}
                    when={recurringWhen(t) ?? cardFacts(t).join(" · ")}
                    photo={t.photo_url ?? undefined}
                    photoAlt={imageAlt(t)}
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
            onToggle={() => {
              setTier3Ever(true);
              setTier3Open((o) => !o);
            }}
            controlsId="explore-tier3"
          />
          <div id="explore-tier3" hidden={!tier3Open}>
            <div className="sbd-feed-section__list sbd-feed-section__list--inner">
              {tier3Ever && tier3.map((t, i) => (
                <div
                  key={t.id}
                  className="sbd-reveal"
                  style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
                >
                  <ListCard
                    id={t.id}
                    href={thingPath(t)}
                    occasionKey={t.tags[0]}
                    title={t.title}
                    blurb={cardBlurb(t)}
                    when={cardMeta(t)}
                    photo={t.photo_url ?? undefined}
                    photoAlt={imageAlt(t)}
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
