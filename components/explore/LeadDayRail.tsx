import Link from "next/link";
import { SaveHeart } from "@/components/ui/SaveHeart";
import { groupByDay } from "@/lib/explore";
import { cardFacts, cardPlace } from "./derive";
import type { Thing } from "@/lib/things";

// ---------------------------------------------------------------------------
// LeadDayRow — a single row in the day rail.
// Whole row links to /thing/${t.id} via sbd-stretch; acts column is isolated.
// ---------------------------------------------------------------------------
function LeadDayRow({
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
  const place = cardPlace(t);
  const facts = cardFacts(t);
  const meta = [place, ...facts].filter(Boolean).join(" · ");

  return (
    <div className="sbd-leadday__it">
      <div className="sbd-leadday__it-body">
        <p className="sbd-leadday__it-nm">
          <Link href={`/thing/${t.id}`} className="sbd-stretch">
            {t.title}
          </Link>
        </p>
        {meta && <p className="sbd-leadday__it-m">{meta}</p>}
      </div>
      <span className="sbd-leadday__it-acts">
        <SaveHeart
          saved={isSaved(t.id)}
          onToggle={() => toggle(t.id)}
          title={t.title}
          tooltip="Save"
        />
        <button
          type="button"
          className="sbd-leadday__it-share"
          onClick={(e) => { e.preventDefault(); onShare(); }}
          aria-label={`Share ${t.title}`}
          data-tooltip="Share"
        >
          ↗
        </button>
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// LeadDayRail — groups Tier-1 week items by SB-local day, days ascending.
// Items within each day preserve their incoming order (already nearMeSort-ed
// by ExploreClient before being passed down).
// ---------------------------------------------------------------------------
export function LeadDayRail({
  items,
  isSaved,
  toggle,
  handleShare,
}: {
  items: Thing[];
  isSaved: (id: string) => boolean;
  toggle: (id: string) => void;
  handleShare: (t: Thing) => void;
}) {
  const days = groupByDay(items);

  return (
    <div className="sbd-leadday-list">
      {days.map(({ dayLabel, dateNum, items: dayItems }) => (
        <div className="sbd-leadday" key={`${dayLabel}-${dateNum}`}>
          <div className="sbd-leadday__dd" aria-hidden="true">
            <div className="sbd-leadday__dd-w">{dayLabel}</div>
            <div className="sbd-leadday__dd-n">{dateNum}</div>
          </div>
          <div className="sbd-leadday__items">
            {dayItems.map((t) => (
              <LeadDayRow
                key={t.id}
                t={t}
                isSaved={isSaved}
                toggle={toggle}
                onShare={() => handleShare(t)}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
