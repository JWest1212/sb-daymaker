import Link from "next/link";
import { SaveHeart } from "@/components/ui/SaveHeart";
import { byDateAsc, formatWhen } from "@/lib/explore";
import { cardBlurb, cardPlace } from "./derive";
import type { Thing } from "@/lib/things";

// ---------------------------------------------------------------------------
// RockTile — full-bleed image tile for the Month lead section.
// Mirrors PickCard's stretch-link + overlay-heart pattern.
// ---------------------------------------------------------------------------
export function RockTile({
  t,
  isSaved,
  toggle,
  onShare,
}: {
  t: Thing;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
  onShare: () => void;
}) {
  const blurb = cardBlurb(t);
  const place = cardPlace(t);
  const when = formatWhen(t.starts_at, t.ends_at);

  return (
    <article
      className={`sbd-rock${t.photo_url ? "" : " sbd-rock--nophoto"}`}
      style={t.photo_url ? { backgroundImage: `url(${t.photo_url})` } : undefined}
    >
      <div className="sbd-rock__ov" aria-hidden="true" />
      {/* Heart + share sit above the stretch link (z-index:2 via .sbd-rock__acts) */}
      <span className="sbd-rock__acts">
        <SaveHeart
          overlay
          saved={isSaved(t.id)}
          onToggle={() => toggle(t.id)}
          title={t.title}
          tooltip="Save"
        />
        <button
          type="button"
          className="sbd-rock__share"
          onClick={(e) => { e.preventDefault(); onShare(); }}
          aria-label={`Share ${t.title}`}
          data-tooltip="Share"
        >
          ↗
        </button>
      </span>
      <div className="sbd-rock__c">
        {when && (
          <span className="sbd-rock__when" aria-label={`Date: ${when}`}>
            {when}
          </span>
        )}
        <h3 className="sbd-rock__ttl">
          <Link href={`/thing/${t.id}`} className="sbd-stretch">
            {t.title}
          </Link>
        </h3>
        {place && <p className="sbd-rock__vn">{place}</p>}
        {blurb && <p className="sbd-rock__nt">{blurb}</p>}
      </div>
    </article>
  );
}

// ---------------------------------------------------------------------------
// RockGrid — sorts month items soonest-first, reveals 8 at a time.
// "See more" loads the next batch of up to 8 (not show-all).
// No "Show less" collapse — explicit product decision.
// ---------------------------------------------------------------------------
export function RockGrid({
  items,
  shownCount,
  onShowMore,
  isSaved,
  toggle,
  handleShare,
}: {
  items: Thing[];
  shownCount: number;
  onShowMore: () => void;
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
  handleShare: (t: Thing) => void;
}) {
  const rocks = byDateAsc(items);
  const shown = rocks.slice(0, shownCount);
  const remaining = rocks.length - shownCount;
  const nextBatch = Math.min(8, remaining);

  return (
    <>
      {shown.map((t) => (
        <RockTile
          key={t.id}
          t={t}
          isSaved={isSaved}
          toggle={toggle}
          onShare={() => handleShare(t)}
        />
      ))}
      {remaining > 0 && (
        <button
          type="button"
          className="sbd-rock-more"
          onClick={onShowMore}
          aria-label={`See ${nextBatch} more events this month`}
        >
          See {nextBatch} more this month →
        </button>
      )}
    </>
  );
}
