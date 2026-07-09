"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { ListCard, EmptyState, SBIcon } from "@/components/ui";
import { SectionHeader } from "@/components/ui/SectionHeader";
import type { Thing } from "@/lib/things";
import type { Horizon } from "@/lib/explore";
import { cardBlurb, cardFacts } from "./derive";
import { RockGrid } from "./RockTile";
import { LeadDayRail } from "./LeadDayRail";

const HORIZON_LABEL: Record<Horizon, string> = {
  today: "Happening Today",
  week: "Happening This Week",
  month: "Happening This Month",
};

function deriveLeadDek(horizon: Horizon, count: number): string | null {
  if (horizon === "today") {
    if (count === 0) return null;
    return count <= 4 ? "A quieter day — worth a look." : "Plenty on today.";
  }
  if (horizon === "week") return "The week ahead in Santa Barbara.";
  return "The month worth building a day around.";
}

// Today opens in the standard left-rail ListCard format — the top-banner
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
}: {
  tier1: Thing[];
  horizon: Horizon;
  monthShownCount: number;
  onMonthShowMore: () => void;
}) {
  return (
    <section className="sbd-feed-section">
      <SectionHeader
        mode="lead"
        label={HORIZON_LABEL[horizon]}
        dek={deriveLeadDek(horizon, tier1.length)}
        sticky={horizon === "today"}
      />
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
  items,
  horizon,
  onClearFilters,
}: {
  items: Thing[];
  horizon: Horizon;
  onClearFilters?: () => void;
}) {
  const [tier2Open, setTier2Open] = useState(false);
  const [tier3Open, setTier3Open] = useState(false);
  const [monthShownCount, setMonthShownCount] = useState(8);
  const feedRef = useRef<HTMLDivElement>(null);
  const onMonthShowMore = useCallback(() => setMonthShownCount((c) => c + 8), []);

  // Reset collapsed state and pagination on horizon change
  useEffect(() => {
    setMonthShownCount(8);
    setTier2Open(false);
    setTier3Open(false);
  }, [horizon]);

  // Reveal stagger — IntersectionObserver adds .is-in; skipped under reduced-motion
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

  if (tier1.length === 0 && tier2.length === 0 && tier3.length === 0) {
    return (
      <div style={{ marginTop: "var(--space-6)" }}>
        <EmptyState
          icon={<SBIcon name="reset" size={28} stroke="var(--sage)" />}
          message="Nothing matches that combination. Try a wider time or a different vibe."
          action={
            onClearFilters ? (
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

  return (
    <div ref={feedRef}>
      {tier1.length > 0 && (
        <LeadSection
          tier1={tier1}
          horizon={horizon}
          monthShownCount={monthShownCount}
          onMonthShowMore={onMonthShowMore}
        />
      )}

      {/* Build your day CTA — Today only */}
      {horizon === "today" && (
        <Link href="/plan" className="sbd-build-cta" aria-label="Build your day">
          <div className="sbd-build-cta__icon" aria-hidden="true">
            <SBIcon name="sun" size={22} stroke="#fff" strokeWidth={1.8} />
          </div>
          <div className="sbd-build-cta__body">
            <span className="sbd-build-cta__title">Build your day</span>
            <span className="sbd-build-cta__sub">
              Tell us the shape — we&rsquo;ll draft it, you tweak it.
            </span>
          </div>
          <span className="sbd-build-cta__arrow" aria-hidden="true">→</span>
        </Link>
      )}

      {/* Every week — Tier 2, collapsed by default */}
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
                  />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Anytime in SB — Tier 3, collapsed by default */}
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
