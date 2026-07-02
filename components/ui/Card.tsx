import Link from "next/link";
import type { OccasionKey } from "@/lib/occasions";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import { Pill, DateEyebrow, PlacePill } from "./Pill";
import { CardActions } from "./CardActions";
import { SBIcon } from "./SBIcon";

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
 * PickCard — editorial feature card: 140px media band, occasion pill (top-left),
 * CardActions scrim cluster (top-right), optional DateEyebrow above title,
 * Fraunces 25px title, secondary text blurb, facts row.
 */
export function PickCard({
  id,
  title,
  blurb,
  occasionKey,
  place,
  facts = [],
  when,
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
  tone?: MediaTone;
  href?: string;
  photo?: string;
}) {
  return (
    <article className="sbd-card sbd-card--interactive sbd-pick">
      <div className={`sbd-pick__media sbd-media--${tone}`}>
        {photo ? (
          <img className="sbd-card__img" src={photo} alt="" loading="lazy" />
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
        {when ? (
          <DateEyebrow>{when}</DateEyebrow>
        ) : null}
        <CardTitle href={href} className="sbd-pick__title">
          {title}
        </CardTitle>
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
 * ListCard — left-rail card: 108px image rail running the full card height,
 * text column (title → blurb → meta) to its right. Vibe pill sits on the
 * photo top-left over a scrim. No-photo fallback: occasion-color gradient +
 * centered icon. Used by Today briefs, This Week rows, and Tier-2/3.
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
}: {
  id: string;
  title: string;
  blurb: string;
  occasionKey?: OccasionKey;
  when?: string;
  tone?: MediaTone; // kept for API compat; occasion color takes precedence in fallback
  href?: string;
  photo?: string;
}) {
  const occ = occasionKey ? OCCASION_BY_KEY[occasionKey] : null;
  const nophoto = !photo;

  return (
    <article className="sbd-card sbd-card--interactive sbd-listcard">
      {/* Rail: 108px image (or fallback gradient) running the full card height */}
      <div
        className={`sbd-listcard__rail${nophoto ? " sbd-listcard__rail--nophoto" : ""}`}
        style={
          nophoto && occ
            ? ({ "--occ-color": occ.color } as React.CSSProperties)
            : undefined
        }
      >
        {photo && (
          <img
            className="sbd-card__img"
            src={photo}
            alt=""
            loading="lazy"
          />
        )}
        {/* Centered icon for no-photo cards */}
        {nophoto && (
          <span className="sbd-listcard__fallmark" aria-hidden="true">
            {occ ? occ.icon : <SBIcon name="sparkle" size={20} stroke="rgba(255,255,255,0.85)" />}
          </span>
        )}
        {/* Dark top gradient — pill legibility on any photo or gradient bg */}
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
