import { ListCard } from "@/components/ui";
import { groupByDay } from "@/lib/explore";
import { cardBlurb, cardFacts } from "./derive";
import type { Thing } from "@/lib/things";

// ---------------------------------------------------------------------------
// LeadDayRail — groups Tier-1 week items by SB-local day, days ascending.
// Each row is now a ListCard (unified chrome). Thumbnails + date-column
// narrowing are Phase 4 (B4); photos are withheld here to keep the rail clean.
// ---------------------------------------------------------------------------
export function LeadDayRail({ items }: { items: Thing[] }) {
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
              <ListCard
                key={t.id}
                id={t.id}
                title={t.title}
                blurb={cardBlurb(t)}
                occasionKey={t.tags[0]}
                when={cardFacts(t).join(" · ")}
                href={`/thing/${t.id}`}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
