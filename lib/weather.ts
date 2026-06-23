// Time-of-day (Santa Barbara) + current weather. Both computed server-side.
// Weather uses OpenWeather (cached) and degrades gracefully without a key.

export type TimeOfDay = "morning" | "afternoon" | "evening" | "night";

const SB_LAT = 34.4208;
const SB_LNG = -119.6982;

/** Current hour bucket in America/Los_Angeles (server-stable, no hydration drift). */
export function getTimeOfDay(): TimeOfDay {
  const hour = Number(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Los_Angeles",
    }).format(new Date()),
  );
  if (hour >= 5 && hour < 11) return "morning";
  if (hour >= 11 && hour < 17) return "afternoon";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

/** Today's date label, Santa Barbara time (e.g. "Monday, June 22"). */
export function getDateLabel(): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "America/Los_Angeles",
  }).format(new Date());
}

export interface Weather {
  tempF: number;
  condition: string; // OpenWeather "main" (Clear, Clouds, Rain…)
  description: string;
  icon: string;
  isClear: boolean;
}

function conditionEmoji(main: string): string {
  const m = main.toLowerCase();
  if (m.includes("clear")) return "☀️";
  if (m.includes("cloud")) return "⛅";
  if (m.includes("rain") || m.includes("drizzle")) return "🌧️";
  if (m.includes("thunder")) return "⛈️";
  if (m.includes("fog") || m.includes("mist") || m.includes("haze")) return "🌫️";
  return "🌤️";
}

/** Current SB weather, or null if no key / fetch fails (hero falls back). */
export async function getWeather(): Promise<Weather | null> {
  const key = process.env.OPENWEATHER_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${SB_LAT}&lon=${SB_LNG}&units=imperial&appid=${key}`,
      { next: { revalidate: 1800 } },
    );
    if (!res.ok) return null;
    const d = await res.json();
    const main: string = d?.weather?.[0]?.main ?? "Clear";
    return {
      tempF: Math.round(d?.main?.temp ?? 0),
      condition: main,
      description: d?.weather?.[0]?.description ?? main,
      icon: conditionEmoji(main),
      isClear: main.toLowerCase().includes("clear"),
    };
  } catch {
    return null;
  }
}
