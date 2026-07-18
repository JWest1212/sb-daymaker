"use client";

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
}) {
  const [broken, markBroken] = usePhotoFallback(photo);
  return (
    <article className="sbd-card sbd-card--interactive sbd-pick">
      {ribbonLabel ? (
        <span className="sbd-pick__ribbon" aria-hidden="true">
          <span className="sbd-pick__ribbon-star">★</span>
          {ribbonLabel}
        </span>
      ) : null}
      <div className={`sbd-pick__media sbd-media--${tone}`}>
        {photo && !broken ? (
          <img className="sbd-card__img" src={photo} alt="" loading="lazy" onError={markBroken} />
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
      <CardActions
        id={id}
        title={title}
        url={`/thing/${id}`}
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
  visual?: CardVisual | null;
}) {
  const occ = occasionKey ? OCCASION_BY_KEY[occasionKey] : null;
  const [broken, markBroken] = usePhotoFallback(photo);
  const nophoto = !photo || broken;

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
        {photo && !broken && (
          <img
            className="sbd-card__img"
            src={photo}
            alt=""
            loading="lazy"
            onError={markBroken}
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
            {occ ? occ.icon : <SBIcon name="sparkle" size={20} stroke="rgba(255,255,255,0.85)" />}
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
          <CardActions id={id} title={title} url={`/thing/${id}`} onImage={false} />
        </div>
      </div>
    </article>
  );
}
