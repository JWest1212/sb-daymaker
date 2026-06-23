import type { Thing } from "@/lib/things";
import type { TimeOfDay, Weather } from "@/lib/weather";
import { SaveHeart } from "@/components/ui";
import { cardBlurb, cardPlace } from "./derive";

const TOD_LABEL: Record<TimeOfDay, string> = {
  morning: "Good morning",
  afternoon: "Good afternoon",
  evening: "Golden hour",
  night: "After dark",
};

function variant(tod: TimeOfDay, weather: Weather | null): string {
  if (weather && !weather.isClear) {
    const c = weather.condition.toLowerCase();
    if (c.includes("cloud") || c.includes("rain") || c.includes("fog")) return "gray";
  }
  return tod;
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
  return (
    <section className={`sbd-hero sbd-hero--${variant(tod, weather)}`}>
      <span className="sbd-hero__sun" aria-hidden="true" />
      {weather && !weather.isClear ? (
        <span className="sbd-hero__cloud" aria-hidden="true" />
      ) : null}

      <div className="sbd-hero__sky">
        <div className="sbd-hero__date">{dateLabel}</div>
        <div className="sbd-hero__cond">
          {weather ? (
            <>
              <span>
                {weather.icon} {weather.tempF}°
              </span>
              <span style={{ textTransform: "capitalize" }}>
                {weather.description}
              </span>
            </>
          ) : (
            <span>{TOD_LABEL[tod]} in Santa Barbara</span>
          )}
        </div>
      </div>

      {pick ? (
        <div className="sbd-hero__pick">
          <div className="sbd-hero__pick-img sbd-media--gold">
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
            <div className="sbd-hero__pick-eyebrow">Today&rsquo;s pick</div>
            <div className="sbd-hero__pick-title">{pick.title}</div>
            <div className="sbd-hero__pick-meta">
              📍 {cardPlace(pick) || "Santa Barbara"}
            </div>
            <div className="sbd-hero__pick-blurb">{cardBlurb(pick)}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
