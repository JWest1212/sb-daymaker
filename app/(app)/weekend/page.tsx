import type { Metadata } from "next";
import Link from "next/link";
import { getPublishedThings } from "@/lib/things";
import { sbDay, sbDayOfWeek } from "@/lib/explore";
import { ZONE_LABEL } from "@/lib/zones";
import { eventDetailWhen } from "@/lib/format/eventTime";
import { thingPath } from "@/lib/seo/site";

// Elevation v1 · Gate 2 · G2.7, the reserved "/weekend" landing surface targeting
// "things to do in Santa Barbara this weekend", the single highest-intent local
// query. Metadata + crawlable content live here now; Gate 4 replaces the body with
// the interactive weekend filter. Kept crawlable (SSR list, real slug links).

export const revalidate = 600;

export const metadata: Metadata = {
  title: "Things to Do in Santa Barbara This Weekend · SB Daymaker",
  description:
    "The weekend in Santa Barbara: events, live music, markets, and outings worth your time, refreshed daily by a local.",
  alternates: { canonical: "/weekend" },
  openGraph: {
    title: "Things to Do in Santa Barbara This Weekend",
    description: "Events, live music, markets, and outings worth your time this weekend in Santa Barbara.",
    url: "/weekend",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Things to Do in Santa Barbara This Weekend",
    description: "Events, live music, markets, and outings worth your time this weekend in Santa Barbara.",
  },
};

/** The upcoming Fri..Sun window as SB date keys (clamped so a Sat/Sun visit still
 *  starts from today, never yesterday). UTC-anchored math to dodge DST drift. */
function weekendWindow(nowMs: number): { fromKey: string; toKey: string } {
  const dow = sbDayOfWeek(nowMs); // 0 = Sun … 6 = Sat
  const todayKey = sbDay(nowMs);
  const [y, m, d] = todayKey.split("-").map(Number);
  const todayUTC = Date.UTC(y, m - 1, d);
  const sunUTC = todayUTC + ((7 - dow) % 7) * 86_400_000;
  const friUTC = sunUTC - 2 * 86_400_000;
  const key = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const friKey = key(friUTC);
  return { fromKey: friKey < todayKey ? todayKey : friKey, toKey: key(sunUTC) };
}

export default async function WeekendPage() {
  const things = await getPublishedThings();
  const { fromKey, toKey } = weekendWindow(Date.now());

  const weekend = things
    .filter((t) => {
      if (!t.starts_at) return false;
      const k = sbDay(new Date(t.starts_at).getTime());
      return k >= fromKey && k <= toKey;
    })
    .sort((a, b) => (a.starts_at ?? "").localeCompare(b.starts_at ?? ""));

  return (
    <div className="sbd-weekend">
      <header className="sbd-weekend__head">
        <p className="sbd-weekend__eyebrow">This weekend in Santa Barbara</p>
        <h1 className="sbd-weekend__title">Things to do this weekend</h1>
        <p className="sbd-weekend__sub">
          Dated events happening Friday to Sunday. For the full picture, head to{" "}
          <Link href="/">Explore</Link>.
        </p>
      </header>

      {weekend.length > 0 ? (
        <ul className="sbd-weekend__list">
          {weekend.map((t) => {
            const zone = t.nearby_zone ? ZONE_LABEL[t.nearby_zone] : null;
            return (
              <li key={t.id} className="sbd-weekend__item">
                <Link href={thingPath(t)} className="sbd-weekend__link">
                  <span className="sbd-weekend__name">{t.title}</span>
                  <span className="sbd-weekend__meta">
                    {t.starts_at ? eventDetailWhen(t.starts_at) : ""}
                    {zone ? ` · ${zone}` : ""}
                    {t.free ? " · Free" : t.price_band ? ` · ${t.price_band}` : ""}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="sbd-weekend__empty">
          Nothing dated on the calendar for this weekend yet. Check{" "}
          <Link href="/">Explore</Link> for places and recurring picks worth a look.
        </p>
      )}
    </div>
  );
}
