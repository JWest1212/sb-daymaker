import Link from "next/link";
import { CardActions, DateEyebrow } from "@/components/ui";
import { byDateAsc, formatWhen } from "@/lib/explore";
import { cardBlurb, cardPlace } from "./derive";
import type { Thing } from "@/lib/things";

// ---------------------------------------------------------------------------
// RockTile — full-bleed image tile for the Month lead section.
// DateEyebrow replaces the gold date pill; CardActions replaces bespoke acts.
// Neighborhood line removed — folded into the eyebrow when available.
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
// RockGrid — sorts month items soonest-first, reveals 8 at a time.
// "See more" loads the next batch of up to 8; no "Show less" collapse.
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
  const nextBatch = Math.min(8, remaining);

  return (
    <>
      {shown.map((t) => (
        <RockTile key={t.id} t={t} />
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
