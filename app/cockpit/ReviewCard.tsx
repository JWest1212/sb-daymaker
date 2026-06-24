import { OCCASION_BY_KEY, type OccasionKey } from "@/lib/occasions";
import { Tag } from "@/components/ui";
import { prettify } from "@/components/explore/derive";
import { approveThing, rejectThing } from "./actions";

export interface ReviewItem {
  id: string;
  title: string;
  type: string;
  blurb: string | null;
  reason_to_go: string | null;
  local_note: string | null;
  happening_category: string | null;
  happening_tier: number;
  neighborhood: string | null;
  address: string | null;
  starts_at: string | null;
  price_band: string | null;
  free: boolean | null;
  is_21_plus: boolean;
  thing_tags: { tag: OccasionKey }[];
}

export function ReviewCard({ item }: { item: ReviewItem }) {
  const tags = item.thing_tags?.map((t) => t.tag) ?? [];
  return (
    <article className="sbd-review">
      <div className="sbd-review__head">
        <span className="sbd-review__type">
          {item.type} · Tier {item.happening_tier}
          {item.happening_category ? ` · ${item.happening_category}` : ""}
        </span>
        <h3 className="sbd-review__title">{item.title}</h3>
      </div>

      {/* Facts (founder-sourced — the AI never wrote these) */}
      <dl className="sbd-review__facts">
        {item.address ? (
          <div>
            <dt>Address</dt>
            <dd>{item.address}</dd>
          </div>
        ) : null}
        {item.neighborhood ? (
          <div>
            <dt>Area</dt>
            <dd>{prettify(item.neighborhood)}</dd>
          </div>
        ) : null}
        {item.starts_at ? (
          <div>
            <dt>Starts</dt>
            <dd>{item.starts_at}</dd>
          </div>
        ) : null}
        <div>
          <dt>Price</dt>
          <dd>{item.free ? "Free" : (item.price_band ?? "—")}</dd>
        </div>
      </dl>

      {/* AI-written copy (review before publishing) */}
      {item.reason_to_go ? (
        <p className="sbd-review__reason">{item.reason_to_go}</p>
      ) : null}
      {item.blurb ? <p className="sbd-review__blurb">{item.blurb}</p> : null}
      {item.local_note ? (
        <p className="sbd-review__note">🤫 {item.local_note}</p>
      ) : null}

      {tags.length ? (
        <div className="sbd-review__tags">
          {tags.map((k) => (
            <Tag key={k} color="neutral">
              {OCCASION_BY_KEY[k]?.label ?? k}
            </Tag>
          ))}
        </div>
      ) : null}

      <div className="sbd-review__actions">
        <form action={rejectThing.bind(null, item.id)}>
          <button type="submit" className="sbd-btn sbd-btn--secondary">
            Reject
          </button>
        </form>
        <form action={approveThing.bind(null, item.id)}>
          <button type="submit" className="sbd-btn sbd-btn--cta">
            Approve &amp; publish
          </button>
        </form>
      </div>
    </article>
  );
}
