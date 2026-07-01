import Link from "next/link";
import type { OccasionKey } from "@/lib/occasions";
import { Pill, DateEyebrow, PlacePill } from "./Pill";
import { CardActions } from "./CardActions";

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
            <Pill occasion={occasionKey} />
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
 * ListCard — Option B: thumb+pill+title in a top row; blurb spans full width
 * below; date eyebrow + actions share a bottom meta row. Thumb omitted when
 * no photo_url — never shows an empty slot.
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
  tone?: MediaTone;
  href?: string;
  photo?: string;
}) {
  return (
    <article className="sbd-card sbd-card--interactive sbd-listcard">
      <div className="sbd-listcard__top">
        {photo ? (
          <div
            className={`sbd-listcard__thumb sbd-media--${tone}`}
            aria-hidden="true"
          >
            <img className="sbd-card__img" src={photo} alt="" loading="lazy" />
          </div>
        ) : null}
        <div className="sbd-listcard__head">
          {occasionKey ? <Pill occasion={occasionKey} /> : null}
          <CardTitle href={href} className="sbd-listcard__title">
            {title}
          </CardTitle>
        </div>
      </div>
      <p className="sbd-listcard__blurb">{blurb}</p>
      <div className="sbd-listcard__meta">
        {when ? <DateEyebrow>{when}</DateEyebrow> : null}
        <CardActions id={id} title={title} url={`/thing/${id}`} onImage={false} />
      </div>
    </article>
  );
}
