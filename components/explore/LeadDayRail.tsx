import { ListCard } from "@/components/ui";
import { thingPath } from "@/lib/seo/site";
import { collapseSeries, groupByDay } from "@/lib/explore";
import { cardBlurb, cardMeta, cardVisual, imageAlt, seriesMeta } from "./derive";
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

// Groups Tier-1 week items by SB-local day; each day shows a sticky header
// (.sbd-dayhead) followed by ListCard rows. Same sticky-handoff mechanic as
// Month's .sbd-weekhead, see components.css. groupByDay() order/logic unchanged.
export function LeadDayRail({ items }: { items: Thing[] }) {
  // R1 W6.4 (D6). One card per series per horizon, so a weekly thing appears
  // once under its next date instead of on every day it runs. Collapsed BEFORE
  // the day grouping, for the same reason Month collapses before week grouping:
  // grouping first means a series only ever meets itself across groups.
  const groups = collapseSeries(items);
  const byLeadId = new Map(groups.map((g) => [g.lead.id, g]));
  const days = groupByDay(groups.map((g) => g.lead));

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
                    when={
                      (byLeadId.get(t.id)?.occurrences.length ?? 1) > 1
                        ? seriesMeta(t, byLeadId.get(t.id)!.cadence, t.starts_at)
                        : cardMeta(t)
                    }
                    dateCount={byLeadId.get(t.id)?.occurrences.length}
                    href={thingPath(t)}
                    photo={t.photo_url ?? undefined}
                    photoAlt={imageAlt(t)}
                    visual={cardVisual(t)}
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
