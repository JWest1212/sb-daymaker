import Link from "next/link";
import type { Thing } from "@/lib/things";
import type { TimeOfDay, Weather } from "@/lib/weather";
import { SaveHeart } from "@/components/ui";
import { cardPlace } from "./derive";

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

const cap = (s: string) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : s);

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
  // S4-B: conditions fold into the date line as one compact row (~2 facts).
  const condBits: string[] = [];
  if (weather) {
    condBits.push(`${weather.icon} ${weather.tempF}°`);
    if (weather.description) condBits.push(cap(weather.description));
  } else {
    condBits.push(TOD_LABEL[tod]);
  }
  const condInline = condBits.slice(0, 2).join(" · ");
  const v = variant(tod, weather);

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

      {/* H2: Santa Barbara skyline silhouette — Mission twin bell towers, a lone
          palm, the Courthouse El Mirador clock tower, stepped red-tile rooftops,
          and the Stearns Wharf pilings. Sits behind the sky text and pick card;
          desaturates with a fog band on marine-layer (gray) days. */}
      <svg
        className="sbd-hero__range"
        viewBox="0 0 600 170"
        preserveAspectRatio="xMidYMax slice"
        aria-hidden="true"
      >
        <path
          className="sbd-hero__hills"
          d="M0,170 L0,104 Q120,70 260,90 Q400,110 520,82 L600,96 L600,170 Z"
        />
        <g className="sbd-hero__buildings">
          {/* Mission: facade + twin bell towers */}
          <rect x="70" y="112" width="124" height="58" />
          <rect x="78" y="80" width="26" height="90" />
          <polygon points="78,80 104,80 91,64" />
          <rect x="160" y="80" width="26" height="90" />
          <polygon points="160,80 186,80 173,64" />
          <polygon points="120,112 144,112 132,96" />
          {/* lone palm */}
          <rect x="214" y="62" width="5" height="108" />
          <path
            className="sbd-hero__palm"
            d="M216,62 Q198,52 188,58 M216,62 Q200,46 196,40 M216,62 Q230,48 240,44 M216,62 Q236,52 248,58 M216,62 Q216,44 214,38"
          />
          {/* Courthouse El Mirador clock tower */}
          <rect x="250" y="58" width="34" height="112" />
          <rect x="256" y="44" width="22" height="16" rx="2" />
          <path d="M256,44 Q267,28 278,44 Z" />
          <rect x="265" y="26" width="4" height="10" />
          <rect className="sbd-hero__window" x="262" y="64" width="10" height="11" />
          {/* stepped red-tile-roof buildings */}
          <rect x="312" y="120" width="46" height="50" />
          <polygon points="312,120 358,120 335,104" />
          <rect x="362" y="112" width="54" height="58" />
          <polygon points="362,112 416,112 389,95" />
          <rect x="420" y="126" width="44" height="44" />
          <polygon points="420,126 464,126 442,112" />
          {/* Stearns Wharf */}
          <rect x="470" y="132" width="130" height="7" />
          <rect x="486" y="139" width="4" height="31" />
          <rect x="512" y="139" width="4" height="31" />
          <rect x="538" y="139" width="4" height="31" />
          <rect x="564" y="139" width="4" height="31" />
          <rect x="590" y="139" width="4" height="31" />
        </g>
      </svg>
      <div className="sbd-hero__fog" aria-hidden="true" />

      <div className="sbd-hero__sky">
        <div className="sbd-hero__date">
          {dateLabel}
          {condInline ? (
            <span className="sbd-hero__cond-inline"> · {condInline}</span>
          ) : null}
        </div>
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
            <div className="sbd-hero__pick-eyebrow">Today&rsquo;s pick</div>
            <div className="sbd-hero__pick-title">
              <Link href={`/thing/${pick.id}`} className="sbd-stretch">
                {pick.title}
              </Link>
            </div>
            <div className="sbd-hero__pick-meta">
              📍 {cardPlace(pick) || "Santa Barbara"}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
