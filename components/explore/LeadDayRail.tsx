import { ListCard } from "@/components/ui";
import { groupByDay } from "@/lib/explore";
import { cardBlurb, cardFacts } from "./derive";
import type { Thing } from "@/lib/things";

const SB_TZ = "America/Los_Angeles";

// Build "WEDNESDAY · JULY 1" from a starts_at ISO string, SB local time.
function formatDayLabel(starts_at: string): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: SB_TZ,
    weekday: "long",
    month: "long",
    day: "numeric",
  }).formatToParts(new Date(starts_at));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return `${value("weekday")} · ${value("month")} ${value("day")}`.toUpperCase();
}

// Groups Tier-1 week items by SB-local day; each day shows a header + spine
// node followed by ListCard rows. groupByDay() order and logic are unchanged.
export function LeadDayRail({ items }: { items: Thing[] }) {
  const days = groupByDay(items);

  return (
    <div className="sbd-daygroup-list">
      {days.map(({ dayLabel, dateNum, items: dayItems }) => {
        const firstStarts = dayItems[0]?.starts_at ?? null;
        const headLabel = firstStarts ? formatDayLabel(firstStarts) : dayLabel;

        return (
          <div className="sbd-daygroup" key={`${dayLabel}-${dateNum}`}>
            <div className="sbd-dayhead">
              <div className="sbd-dayhead__label">{headLabel}</div>
              <div className="sbd-dayhead__rule" aria-hidden="true" />
            </div>
            <div className="sbd-daygroup__list">
              {dayItems.map((t, i) => (
                <div
                  key={t.id}
                  className="sbd-reveal"
                  style={{ transitionDelay: `${Math.min(i, 5) * 60}ms` }}
                >
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
          </div>
        );
      })}
    </div>
  );
}
