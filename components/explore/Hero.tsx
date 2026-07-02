import Link from "next/link";
import type { Thing } from "@/lib/things";
import type { TimeOfDay, Weather } from "@/lib/weather";
import { SaveHeart } from "@/components/ui";
import { cardPlace, heroCta, heroEyebrow, heroTime } from "./derive";
import { ConditionChips } from "./ConditionChips";

const TOD_LABEL: Record<TimeOfDay, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Golden hour",
  night: "After dark",
};

function isGrayDay(weather: Weather | null): boolean {
  if (!weather || weather.isClear) return false;
  const c = weather.condition.toLowerCase();
  return c.includes("cloud") || c.includes("rain") || c.includes("fog");
}

function variant(tod: TimeOfDay, weather: Weather | null): string {
  return isGrayDay(weather) ? "gray" : tod;
}

export function Hero({
  tod,
  dateLabel,
  weather,
  pick,
  saved,
  onToggleSave,
}: {
  tod: TimeOfDay;
  dateLabel: string;
  weather: Weather | null;
  pick: Thing | null;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const gray = isGrayDay(weather);
  const v = variant(tod, weather);

  // Re-dressed pick meta: `{venue} · {time}` (spec §2.2.2). Never the bare city.
  const meta = pick
    ? [cardPlace(pick), heroTime(pick)].filter(Boolean).join(" · ")
    : "";

  return (
    <section className={`sbd-hero sbd-hero--${v}`}>
      {/* Warm horizon glow behind the skyline so the silhouette reads in every
          sky — and doubles as the sunset glow at golden hour. Hidden on gray
          days, where the fog band takes over instead. */}
      <div className="sbd-hero__glow" aria-hidden="true" />
      <span className="sbd-hero__sun" aria-hidden="true" />
      {weather && !weather.isClear ? (
        <span className="sbd-hero__cloud" aria-hidden="true" />
      ) : null}

      {/* H2: hand-styled Santa Barbara skyline (Riviera hillside, Mission,
          Courthouse, wharf, Lil' Toot). Golden-hour buildings under a changing
          sky — scene colors are baked into the asset by design (spec §3.4). The
          hero's overflow:hidden crops the transparent upper sky at both widths. */}
      <img
        className="sbd-hero__range"
        src="/hero/sb-skyline.svg"
        alt=""
        aria-hidden="true"
      />
      <div className="sbd-hero__fog" aria-hidden="true" />

      <div className="sbd-hero__sky">
        <div className="sbd-hero__date">
          {dateLabel}
          <span className="sbd-hero__daypart"> · {TOD_LABEL[tod]}</span>
        </div>
        <ConditionChips weather={weather} />
      </div>

      {pick ? (
        <div className="sbd-hero__pick">
          <div className="sbd-hero__pick-img sbd-media--gold">
            {pick.photo_url ? (
              <img className="sbd-card__img" src={pick.photo_url} alt="" loading="lazy" />
            ) : null}
            <span className="sbd-hero__pick-heart">
              <SaveHeart
                overlay
                saved={saved}
                onToggle={onToggleSave}
                title={pick.title}
              />
            </span>
          </div>
          <div className="sbd-hero__pick-body">
            <div className="sbd-hero__pick-eyebrow">{heroEyebrow(pick, gray)}</div>
            <div className="sbd-hero__pick-title">
              <Link href={`/thing/${pick.id}`} className="sbd-stretch">
                {pick.title}
              </Link>
            </div>
            {meta ? <div className="sbd-hero__pick-meta">{meta}</div> : null}
            <div className="sbd-hero__pick-cta">{heroCta(pick)}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
