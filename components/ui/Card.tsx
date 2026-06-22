import { Tag, type TagColor } from "./Chip";
import { SaveHeart } from "./SaveHeart";

type MediaTone = "gold" | "sage" | "pacific";

/**
 * PickCard — the editorial hero card from the wireframe: a media banner with a
 * gold tag (top-left), the save heart (top-right), and a place pill
 * (bottom-left), over a Fraunces title, blurb, and a facts row.
 */
export function PickCard({
  title,
  blurb,
  tag,
  place,
  facts = [],
  saved,
  onToggleSave,
  tone = "gold",
}: {
  title: string;
  blurb: string;
  tag?: string;
  place?: string;
  facts?: string[];
  saved: boolean;
  onToggleSave: () => void;
  tone?: MediaTone;
}) {
  return (
    <article className="sbd-card sbd-card--interactive sbd-pick">
      <div className={`sbd-pick__media sbd-media--${tone}`}>
        {tag ? (
          <span className="sbd-pick__tag">
            <Tag color="gold">{tag}</Tag>
          </span>
        ) : null}
        <span className="sbd-pick__heart">
          <SaveHeart overlay saved={saved} onToggle={onToggleSave} title={title} />
        </span>
        {place ? <span className="sbd-pick__place">📍 {place}</span> : null}
      </div>
      <div className="sbd-pick__body">
        <h3 className="sbd-pick__title">{title}</h3>
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
 * ListCard — compact horizontal card: media thumb + body with a micro tag,
 * Fraunces title, blurb, and a meta line. Optional save heart on the right.
 */
export function ListCard({
  title,
  blurb,
  tag,
  tagColor = "sage",
  meta,
  tone = "sage",
  saved,
  onToggleSave,
}: {
  title: string;
  blurb: string;
  tag?: string;
  tagColor?: TagColor;
  meta?: string;
  tone?: MediaTone;
  saved?: boolean;
  onToggleSave?: () => void;
}) {
  return (
    <article className="sbd-card sbd-card--interactive sbd-listcard">
      <div className={`sbd-listcard__thumb sbd-media--${tone}`} aria-hidden="true" />
      <div className="sbd-listcard__body">
        {tag ? (
          <Tag color={tagColor} micro>
            {tag}
          </Tag>
        ) : null}
        <h3 className="sbd-listcard__title">{title}</h3>
        <p className="sbd-listcard__blurb">{blurb}</p>
        {meta ? <div className="sbd-listcard__meta">{meta}</div> : null}
      </div>
      {onToggleSave ? (
        <span className="sbd-listcard__heart">
          <SaveHeart saved={!!saved} onToggle={onToggleSave} title={title} />
        </span>
      ) : null}
    </article>
  );
}
