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

// W1.3b Layer 2 — the hero's last-resort parachute when the published pool has
// zero evergreen things (cold DB / upstream fetch failure). Hardcoded because
// it's the safety net, not content; renders CTA-only (no save heart — not a DB row).
const COURTHOUSE_FALLBACK = {
  eyebrow: "Always worth it",
  title: "The Courthouse clock tower",
  line: "The best free view in town — hand-painted ceilings on the way up, the whole city and the sea at the top.",
  cta: "Find your way there →",
  href: "/discover",
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
  fallbackNote = false,
  staticFallback = false,
}: {
  tod: TimeOfDay;
  dateLabel: string;
  weather: Weather | null;
  pick: Thing | null;
  saved: boolean;
  onToggleSave: () => void;
  /** Layer 1: `pick` is a deterministic evergreen fallback — show the soft note. */
  fallbackNote?: boolean;
  /** Layer 2: no thing at all — render the hardcoded static parachute card. */
  staticFallback?: boolean;
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

      {/* Marine-layer fog band (gray days only). Rendered BEFORE the skyline so
          the opaque golden buildings paint on top of it — the fog reads as haze
          in the sky gaps, never a white wash over the city (spec §3.4). */}
      <div className="sbd-hero__fog" aria-hidden="true" />

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
            {/* W1.3b Layer 1: shown only when this pick is an evergreen fallback. */}
            {fallbackNote ? (
              <p className="sbd-hero__pick-note">
                Nothing matches that exactly today — but this is always worth it.
              </p>
            ) : null}
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
      ) : staticFallback ? (
        // W1.3b Layer 2: hardcoded parachute — CTA to Discover, no save heart.
        <div className="sbd-hero__pick">
          <div className="sbd-hero__pick-body">
            <div className="sbd-hero__pick-eyebrow">{COURTHOUSE_FALLBACK.eyebrow}</div>
            <div className="sbd-hero__pick-title">
              <Link href={COURTHOUSE_FALLBACK.href} className="sbd-stretch">
                {COURTHOUSE_FALLBACK.title}
              </Link>
            </div>
            <div className="sbd-hero__pick-meta">{COURTHOUSE_FALLBACK.line}</div>
            <div className="sbd-hero__pick-cta">{COURTHOUSE_FALLBACK.cta}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
