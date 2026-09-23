"use client";

import { sizedPhoto, type PhotoSlot } from "@/lib/photoSize";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { OccasionKey } from "@/lib/occasions";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import { Pill, DateEyebrow, PlacePill } from "./Pill";
import { CardActions } from "./CardActions";
import { SBIcon } from "./SBIcon";
import { MOTIFS, BigTypeArt, BIGTYPE_TINT_CLASS } from "@/components/visuals";
import type { MotifKey } from "@/lib/visualAssignment";

/** Card Imagery Build Spec Phase 3 §6.2, the motif tier's render-order input.
 *  `undefined`/no match means "no motif assigned", the card falls through to the
 *  pre-existing occasion-gradient fallback (now the last-resort catch). Derived
 *  from a `Thing` by `components/explore/derive.ts`'s `cardVisual()` so callers
 *  don't hand-assemble this shape themselves. */
export interface CardVisual {
  kind: "motif" | "bigtype";
  key: string | null;
  startsAt: string | null;
  neighborhood: string | null;
  nearbyZone: string | null;
  category: string | null;
}

/**
 * Performance pass (2026-09-22). The photo to show, at the size the slot needs.
 * Tries the resized copy first (lib/photoSize.ts); if that fails to load, the
 * original; only if both fail does the card fall back to its colour art. So
 * asking for a smaller photo can never cost a card its picture.
 */
export function usePhoto(
  original: string | null | undefined,
  slot: PhotoSlot,
): { src: string | null; onError: () => void; broken: boolean } {
  const sized = sizedPhoto(original, slot);
  // The stage is remembered together with the URL it belongs to, so a new photo
  // starts fresh at the resized copy without an effect to reset it.
  const [fail, setFail] = useState<{ url: string | null | undefined; stage: number }>({ url: original, stage: 0 });
  const stage = fail.url === original ? fail.stage : 0; // 0 sized, 1 original, 2 broken
  const src = !original ? null : stage === 0 ? sized : stage === 1 ? original : null;
  const onError = () =>
    setFail({ url: original, stage: stage === 0 && sized !== original ? 1 : 2 });
  return { src, onError, broken: !original || stage === 2 };
}

/** Card Imagery Build Spec Phase 2 §5.5, "fallback resilience": a Google
 *  `serving_url` can 403/404 between nightly refreshes (no cheap server-side way to
 *  detect that ahead of render), so the client falls back to the gradient itself.
 *  Resets whenever the photo URL changes so a fresh pick gets its own chance to
 *  load rather than inheriting a prior URL's failure. */

export function usePhotoFallback(photo: string | undefined): [boolean, () => void] {
  const [broken, setBroken] = useState(false);
  useEffect(() => setBroken(false), [photo]);
  return [broken, () => setBroken(true)];
}

type MediaTone = "gold" | "sage" | "pacific";

/** Title as a stretched link covering the whole card. */
function CardTitle({
  href,
  className,
  children,
}: {
  href?: string;
  className: string;
  children: React.ReactNode;
}) {
  return (
    <h3 className={className}>
      {href ? (
        <Link href={href} className="sbd-stretch">
          {children}
        </Link>
      ) : (
        children
      )}
    </h3>
  );
}

/**
 * PickCard, editorial feature card: 140px media band, occasion pill (top-left),
 * CardActions scrim cluster (top-right), optional DateEyebrow above title,
 * Fraunces 25px title, secondary text blurb, facts row.
 *
 * Home Rework spec §12/§15, `ribbonLabel` turns this into the R1 "Today's pick"
 * card (elevated atop the feed lead section): a folded-corner ribbon over the
 * media, plus a `contextEyebrow` (the old hero's heroEyebrow()) and `meta` (the
 * old hero's "{place} · {time}" line) between the title and blurb. The ribbon is
 * decorative (aria-hidden), the card's accessible name is still just the title,
 * via CardTitle's stretched link, same as every other card.
 */
export function PickCard({
  id,
  title,
  blurb,
  occasionKey,
  place,
  facts = [],
  when,
  meta,
  contextEyebrow,
  ribbonLabel,
  tone = "gold",
  href,
  photo,
  photoAlt,
}: {
  id: string;
  title: string;
  blurb: string;
  occasionKey?: OccasionKey;
  place?: string;
  facts?: string[];
  when?: string;
  /** R1, a single "{place} · {time}" line between the title and blurb. */
  meta?: string;
  /** R1, the contextual eyebrow (e.g. "Catch a show", "Gray-day move") above the title. */
  contextEyebrow?: string;
  /** R1, folded-corner ribbon label ("Today's pick" or its horizon variant). Sponsor-blind: set purely from horizon, never from sponsor/featured status. */
  ribbonLabel?: string;
  tone?: MediaTone;
  href?: string;
  photo?: string;
  /** R1 W5.7. Describes the PHOTOGRAPH, which on a card is the only picture of
   *  the thing being recommended and is therefore not decorative. */
  photoAlt?: string;
}) {
  const pic = usePhoto(photo, "card");
  return (
    <article className="sbd-card sbd-card--interactive sbd-pick">
      {ribbonLabel ? (
        <span className="sbd-pick__ribbon" aria-hidden="true">
          <span className="sbd-pick__ribbon-star">★</span>
          {ribbonLabel}
        </span>
      ) : null}
      <div className={`sbd-pick__media sbd-media--${tone}`}>
        {pic.src ? (
          <img className="sbd-card__img" src={pic.src} alt={photoAlt ?? ""} loading="lazy" fetchPriority="low" decoding="async" onError={pic.onError} />
        ) : null}
        {occasionKey ? (
          <span className="sbd-pick__tag">
            <Pill occasion={occasionKey} short />
          </span>
        ) : null}
        {place ? (
          <span className="sbd-pick__place">
            <PlacePill neighborhood={place} />
          </span>
        ) : null}
      </div>
      {/* CardActions sits outside media so it isn't clipped by overflow:hidden */}
      {/* R1 W6.7 (MAP-001). Share the card's own href, which is already the
          slug. Rebuilding the URL from the id meant every share off the hero
          carried a UUID even though the card itself linked to the slug. */}
      <CardActions
        id={id}
        title={title}
        url={href ?? `/thing/${id}`}
        onImage
      />
      <div className="sbd-pick__body">
        {contextEyebrow ? <div className="sbd-pick__eyebrow">{contextEyebrow}</div> : null}
        <CardTitle href={href} className="sbd-pick__title">
          {title}
        </CardTitle>
        {meta ? (
          <div className="sbd-pick__meta">{meta}</div>
        ) : when ? (
          <DateEyebrow>{when}</DateEyebrow>
        ) : null}
        <p className="sbd-pick__blurb">{blurb}</p>
        {facts.length > 0 ? (
          <div className="sbd-pick__facts">
            {facts.map((f, i) => (
              <span key={i}>{f}</span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * ListCard, left-rail card: 108px image rail running the full card height,
 * text column (title → blurb → meta) to its right. Vibe pill sits on the
 * photo top-left over a scrim. Render order when there's no photo (Card
 * Imagery Build Spec Phase 3 §6.2): motif -> bigtype -> occasion-color
 * gradient + centered icon (the pre-existing fallback, now the last resort, * every Tier-1 event and every resolver miss carries a `visual` since Phase 3,
 * so this only fires if one is somehow missing). Used by Today briefs, This
 * Week rows, and Tier-2/3.
 */
export function ListCard({
  id,
  title,
  blurb,
  occasionKey,
  when,
  tone = "sage",
  href,
  photo,
  photoAlt,
  dateCount,
  visual,
}: {
  id: string;
  title: string;
  blurb: string;
  occasionKey?: OccasionKey;
  when?: string;
  tone?: MediaTone; // kept for API compat; occasion color takes precedence in fallback
  href?: string;
  photo?: string;
  /** R1 W5.7. Describes the PHOTOGRAPH. The generated motif and big-type
   *  fallbacks below stay alt="" because they genuinely are decorative. */
  photoAlt?: string;
  /** R1 W6.4 (D6). How many dates this series has in the current horizon. Shown
   *  as a small "N dates" affordance, so a collapsed card says what it stands
   *  for rather than silently hiding sixteen other Sundays. */
  dateCount?: number;
  visual?: CardVisual | null;
}) {
  const occ = occasionKey ? OCCASION_BY_KEY[occasionKey] : null;
  const pic = usePhoto(photo, "rail");
  const nophoto = pic.broken;

  const motif = nophoto && visual?.kind === "motif" && visual.key ? MOTIFS[visual.key as MotifKey] : undefined;
  const showBigType = nophoto && !motif && visual?.kind === "bigtype";
  const showGradient = nophoto && !motif && !showBigType;
  const tintClass = motif ? motif.tintClass : showBigType ? BIGTYPE_TINT_CLASS : undefined;

  return (
    <article className="sbd-card sbd-card--interactive sbd-listcard">
      {/* Rail: 108px image (or motif/bigtype/gradient fallback) running the full card height */}
      <div
        className={`sbd-listcard__rail${showGradient ? " sbd-listcard__rail--nophoto" : ""}${tintClass ? ` ${tintClass}` : ""}`}
        style={
          showGradient && occ
            ? ({ "--occ-color": occ.color } as React.CSSProperties)
            : undefined
        }
      >
        {pic.src && (
          <img
            className="sbd-card__img"
            src={pic.src}
            alt={photoAlt ?? ""}
            loading="lazy"
            /* R1 W6.9 (TP-B-05). A card photograph is never the thing the
               visitor is waiting for; the hero is. Low priority keeps these off
               the connection while the hero is still arriving. */
            fetchPriority="low"
            decoding="async"
            onError={pic.onError}
          />
        )}
        {motif && <motif.Art />}
        {showBigType && (
          <BigTypeArt
            startsAt={visual?.startsAt ?? null}
            neighborhood={visual?.neighborhood ?? null}
            nearbyZone={visual?.nearbyZone ?? null}
            category={visual?.category ?? null}
          />
        )}
        {/* Centered icon for the last-resort gradient fallback only */}
        {showGradient && (
          <span className="sbd-listcard__fallmark" aria-hidden="true">
            {<SBIcon name="sparkle" size={20} stroke="rgba(255,255,255,0.85)" />}
          </span>
        )}
        {/* Dark top gradient, pill legibility on any photo, motif, or gradient bg */}
        <div className="sbd-listcard__scrim" aria-hidden="true" />
        {/* Occasion pill, top-left, over scrim */}
        {occasionKey && (
          <span className="sbd-listcard__pill-wrap">
            <Pill occasion={occasionKey} short />
          </span>
        )}
      </div>

      {/* Text column: title (first) → blurb → meta row pinned to base */}
      <div className="sbd-listcard__side">
        <CardTitle href={href} className="sbd-listcard__title">
          {title}
        </CardTitle>
        <p className="sbd-listcard__blurb">{blurb}</p>
        <div className="sbd-listcard__meta">
          {when ? <DateEyebrow>{when}</DateEyebrow> : null}
          {/* R1 W6.4 (D6). A collapsed series says how many dates it stands for.
              Not a link of its own: the whole card already goes to the detail
              page, which lists the dates. */}
          {dateCount && dateCount > 1 ? (
            <span className="sbd-listcard__dates">{dateCount} dates</span>
          ) : null}
          <CardActions id={id} title={title} url={href ?? `/thing/${id}`} onImage={false} />
        </div>
      </div>
    </article>
  );
}
