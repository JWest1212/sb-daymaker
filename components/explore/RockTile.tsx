import Link from "next/link";
import { useEffect, useRef } from "react";
import { CardActions, DateEyebrow } from "@/components/ui";
import { byDateAsc, formatWhen, groupByWeek } from "@/lib/explore";
import { cardBlurb, cardPlace } from "./derive";
import type { Thing } from "@/lib/things";

// ---------------------------------------------------------------------------
// RockTile, full-bleed image tile for the Month lead section.
// DateEyebrow replaces the gold date pill; CardActions replaces bespoke acts.
// Neighborhood line removed, folded into the eyebrow when available.
// ---------------------------------------------------------------------------
function RockTile({ t }: { t: Thing }) {
  const blurb = cardBlurb(t);
  const place = cardPlace(t);
  const when = formatWhen(t.starts_at, t.ends_at);

  // Fold neighborhood into the eyebrow: "JUN 30 · MONTECITO" if both exist.
  const eyebrow = when && place ? `${when} · ${place.toUpperCase()}` : (when ?? undefined);

  return (
    <article
      className={`sbd-rock${t.photo_url ? "" : " sbd-rock--nophoto"}`}
      style={t.photo_url ? { backgroundImage: `url(${t.photo_url})` } : undefined}
    >
      <div className="sbd-rock__ov" aria-hidden="true" />
      {/* CardActions sits above the stretch link (z-index:3 via --on-image) */}
      <CardActions
        id={t.id}
        title={t.title}
        url={`/thing/${t.id}`}
        onImage
      />
      <div className="sbd-rock__c">
        {eyebrow && (
          <DateEyebrow onImage>{eyebrow}</DateEyebrow>
        )}
        <h3 className="sbd-rock__ttl">
          <Link href={`/thing/${t.id}`} className="sbd-stretch">
            {t.title}
          </Link>
        </h3>
        {blurb && <p className="sbd-rock__nt">{blurb}</p>}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// RockGrid, sorts month items soonest-first, grouped by SB-local calendar
// week. Each week's header is sticky (same top/z-index as SectionHeader's
// lead mode) so it hands off to the next week's header as the user scrolls, // a native-CSS "always know which week you're viewing" cue.
// Infinite scroll: an off-screen sentinel past the last loaded tile requests
// the next batch of 8 as it nears the viewport, so the feed keeps loading
// itself rather than waiting on a "See more" click.
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
  const rocks = byDateAsc(items);
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
            {week.items.map((t, i) => (
              <div
                key={t.id}
                className="sbd-reveal"
                style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
              >
                <RockTile t={t} />
              </div>
            ))}
          </div>
        </div>
      ))}
      {remaining > 0 && <div ref={sentinelRef} aria-hidden="true" />}
    </>
  );
}
