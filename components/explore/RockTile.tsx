import { thingPath } from "@/lib/seo/site";
import { useEffect, useRef } from "react";
import { ListCard } from "@/components/ui";
import { byDateAsc, collapseSeries, groupByWeek } from "@/lib/explore";
import { cardBlurb, cardMeta, cardVisual, imageAlt, seriesMeta } from "./derive";
import type { Thing } from "@/lib/things";

// ---------------------------------------------------------------------------
// R1 W6.4 (EXP-025, EXP-026). The full-bleed RockTile is RETIRED.
//
// It put small text over a photograph, which made its contrast unmeasurable
// (TP-C7-07 could not score it by any reliable method), used a different meta
// order from every other card, and meant a card said something different
// depending on which horizon tab you were on. Month now renders the same
// ListCard as Today, Week and Weekend. This file keeps only the week-grouped
// grid, which is genuinely Month-specific.
// ---------------------------------------------------------------------------

export function RockGrid({
  items,
  shownCount,
  onShowMore,
}: {
  items: Thing[];
  shownCount: number;
  onShowMore: () => void;
}) {
  // R1 W6.4 (D6). Collapse to one card per series BEFORE grouping by week.
  // Grouping first and collapsing inside each week never collapses anything: a
  // weekly series has exactly one occurrence per week, so it would meet itself
  // only across weeks. "One card per series per horizon" means the horizon.
  const groups = collapseSeries(byDateAsc(items));
  const groupByLeadId = new Map(groups.map((g) => [g.lead.id, g]));
  const rocks = groups.map((g) => g.lead);
  const shown = rocks.slice(0, shownCount);
  const remaining = rocks.length - shownCount;
  const weeks = groupByWeek(shown);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (remaining <= 0) return;
    const el = sentinelRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) onShowMore();
      },
      { rootMargin: "600px 0px" },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [remaining, onShowMore]);

  return (
    <>
      {weeks.map((week) => (
        <div className="sbd-weekgroup" key={week.weekKey}>
          {week.weekLabel && (
            <div className="sbd-weekhead">
              <div className="sbd-weekhead__label">{week.weekLabel}</div>
            </div>
          )}
          <div className="sbd-weekgroup__list">
            {/* R1 W6.4 (EXP-025, EXP-026). Month uses the SAME list card as every
                other horizon. The photo-over-text tile is retired: it put small
                text over a photograph (unmeasurable contrast, TP-C7-07), used a
                different meta order from the rest of the site, and meant a card
                meant something different depending on which tab you were on.
                Series collapse applies here too. */}
            {week.items.map((t, i) => {
              const g = groupByLeadId.get(t.id);
              if (!g) return null;
              return (
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
              );
            })}
          </div>
        </div>
      ))}
      {remaining > 0 && <div ref={sentinelRef} aria-hidden="true" />}
    </>
  );
}
