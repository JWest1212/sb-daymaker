import { ListCard } from "@/components/ui";
import { groupByDay } from "@/lib/explore";
import { cardBlurb, cardFacts } from "./derive";
import type { Thing } from "@/lib/things";

// Groups Tier-1 week items by SB-local day; each row is a ListCard.
// Date column (44px) shows weekday+number on the first row of each day group;
// subsequent rows use a narrow indent so content reclaims the space.
export function LeadDayRail({ items }: { items: Thing[] }) {
  const days = groupByDay(items);

  return (
    <div className="sbd-leadday-list">
      {days.map(({ dayLabel, dateNum, items: dayItems }) => (
        <div className="sbd-leadday" key={`${dayLabel}-${dateNum}`}>
          {dayItems.map((t, idx) => (
            <div
              key={t.id}
              className={`sbd-leadday-row${idx === 0 ? " sbd-leadday-row--first" : ""}`}
            >
              <div className="sbd-leadday__dd" aria-hidden="true">
                {idx === 0 ? (
                  <>
                    <div className="sbd-leadday__dd-w">{dayLabel}</div>
                    <div className="sbd-leadday__dd-n">{dateNum}</div>
                  </>
                ) : null}
              </div>
              <ListCard
                id={t.id}
                title={t.title}
                blurb={cardBlurb(t)}
                occasionKey={t.tags[0]}
                when={cardFacts(t).join(" · ")}
                href={`/thing/${t.id}`}
                photo={t.photo_url ?? undefined}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
