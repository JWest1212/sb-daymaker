import type { TimeOfDay, Weather } from "@/lib/weather";
import { isGrayDay } from "./derive";
import { ConditionChips } from "./ConditionChips";

const TOD_LABEL: Record<TimeOfDay, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Golden hour",
  night: "After dark",
};

function variant(tod: TimeOfDay, weather: Weather | null): string {
  return isGrayDay(weather) ? "gray" : tod;
}

/** Home Rework spec §10, the daily pick card is retired from here (it returns in
 *  Phase 5 as the elevated "Today's pick" atop the feed); this is now a pure
 *  value-prop band over the untouched skyline. No client state left, so this is a
 *  server component again. */
export function Hero({
  tod,
  dateLabel,
  weather,
}: {
  tod: TimeOfDay;
  dateLabel: string;
  weather: Weather | null;
}) {
  const v = variant(tod, weather);

  return (
    <section className={`sbd-hero sbd-hero--${v}`}>
      {/* Warm horizon glow behind the skyline so the silhouette reads in every
          sky, and doubles as the sunset glow at golden hour. Hidden on gray
          days, where the fog band takes over instead. */}
      <div className="sbd-hero__glow" aria-hidden="true" />
      <span className="sbd-hero__sun" aria-hidden="true" />
      {weather && !weather.isClear ? (
        <span className="sbd-hero__cloud" aria-hidden="true" />
      ) : null}

      {/* Marine-layer fog band (gray days only). Rendered BEFORE the skyline so
          the opaque golden buildings paint on top of it, the fog reads as haze
          in the sky gaps, never a white wash over the city (spec §3.4). */}
      <div className="sbd-hero__fog" aria-hidden="true" />

      {/* H2: hand-styled Santa Barbara skyline (Riviera hillside, Mission,
          Courthouse, wharf, Lil' Toot). Golden-hour buildings under a changing
          sky, scene colors are baked into the asset by design (spec §3.4). The
          hero's overflow:hidden crops the transparent upper sky at both widths.
          Home Rework spec §1 guardrail: this asset is untouched, byte-for-byte. */}
      <img
        className="sbd-hero__range"
        src="/hero/sb-skyline.svg"
        alt=""
        aria-hidden="true"
      />

      <div className="sbd-hero__sky">
        <div className="sbd-hero__date">
          {dateLabel}
          <span className="sbd-hero__daypart"> · {TOD_LABEL[tod]}</span>
        </div>
        <ConditionChips weather={weather} />

        {/* Home Rework spec §10/§13, locked Voice 1 copy, verbatim. */}
        <div className="sbd-hero__vp">
          <h1 className="sbd-hero__vp-headline">
            Everything worth doing in Santa Barbara, in one place.
          </h1>
          <p className="sbd-hero__vp-sub">
            Scattered across a dozen sites, gathered here and curated by someone
            who knows the town. Find it, save it, make a plan.
          </p>
        </div>
      </div>
    </section>
  );
}
