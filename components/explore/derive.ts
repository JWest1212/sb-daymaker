import type { Thing } from "@/lib/things";
import type { Weather } from "@/lib/weather";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import type { TagColor } from "@/components/ui/Chip";
import type { CardVisual } from "@/components/ui/Card";

/** Shared by Hero (sky variant) and the R1 "Today's pick" card's contextual
 *  eyebrow (heroEyebrow below) — moved here so both can import one definition. */
export function isGrayDay(weather: Weather | null): boolean {
  if (!weather || weather.isClear) return false;
  const c = weather.condition.toLowerCase();
  return c.includes("cloud") || c.includes("rain") || c.includes("fog");
}

const TONES = ["gold", "sage", "pacific"] as const;
export type Tone = (typeof TONES)[number];

export function cardTone(index: number): Tone {
  return TONES[index % TONES.length];
}

export function prettify(s: string | null | undefined): string {
  if (!s) return "";
  return s
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function cardTag(t: Thing): string | undefined {
  const k = t.tags[0];
  return k ? OCCASION_BY_KEY[k]?.label : undefined;
}

/**
 * Color-code the list-card label pill by kind (QW-2): places teal, free
 * green, everything else terracotta. All three clear AA with white text
 * (raw --sage does not, so the pill uses the darkened sage token).
 */
export function cardTagColor(t: Thing): TagColor {
  if (t.type === "place") return "pacific";
  if (t.free) return "sage";
  return "terracotta";
}

export function cardPlace(t: Thing): string | undefined {
  return t.neighborhood ? prettify(t.neighborhood) : undefined;
}

function eventTime(iso: string): string {
  // Assemble from parts rather than letting Intl auto-join: Node's ICU and the
  // browser's disagree on the weekday/time separator ("Fri 12 PM" vs "Fri, 12
  // PM"), which causes a React hydration mismatch. Joining the meaningful parts
  // ourselves yields the same string on server and client.
  const parts = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    hour: "numeric",
    timeZone: "America/Los_Angeles",
  }).formatToParts(new Date(iso));
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return [value("weekday"), value("hour"), value("dayPeriod")]
    .filter(Boolean)
    .join(" ");
}

export function cardFacts(t: Thing): string[] {
  const facts: string[] = [];
  if (t.free) facts.push("Free");
  else if (t.price_band) facts.push(t.price_band);
  if (t.type === "event" && t.starts_at) facts.push(eventTime(t.starts_at));
  if (t.is_21_plus) facts.push("21+");
  return facts;
}

export function cardBlurb(t: Thing): string {
  return t.blurb ?? t.reason_to_go ?? "";
}

/** Card Imagery Build Spec Phase 3 §6.2 — `ListCard`'s motif/bigtype render input,
 *  assembled from the fields `resolveImages()` already wrote. `undefined` when the
 *  thing has no visual assigned (a real photo, or a row that predates Phase 3's
 *  backfill) — `ListCard` falls through to the pre-existing gradient in that case. */
export function cardVisual(t: Thing): CardVisual | undefined {
  if (t.visual_kind !== "motif" && t.visual_kind !== "bigtype") return undefined;
  return {
    kind: t.visual_kind,
    key: t.visual_key,
    startsAt: t.starts_at,
    neighborhood: t.neighborhood,
    nearbyZone: t.nearby_zone,
    category: t.happening_category,
  };
}

// --------------------------------------------------------------------------
// Hero pick-card dress (Doc "One Front Page" §2.2). Presentation only.
// --------------------------------------------------------------------------

// Live `happening_category` enum values (lib/enrich.ts) that back each eyebrow
// bucket — the spec's wireframe shorthand (music/arts/happyhour) mapped onto the
// real categories the pipeline actually writes.
const MUSIC_CATS = new Set(["live_music"]);
const ARTS_CATS = new Set(["arts_theater", "recurring_arts"]);

/**
 * Context-aware eyebrow for the hero pick. First match wins (spec §2.2.1).
 * Keys off the site's true enums: `happening_category` for the music/arts
 * buckets, and the `happyhour` thing `type` (there is no happy-hour category).
 */
export function heroEyebrow(t: Thing, grayDay: boolean): string {
  if (grayDay) return "Gray day move";
  if (t.type === "place") return "Place to be";
  if (t.free) return "Free · Today";
  const cat = t.happening_category ?? "";
  if (MUSIC_CATS.has(cat)) return "Catch a show";
  if (ARTS_CATS.has(cat)) return "Arts & culture";
  if (t.type === "happyhour") return "Happy hour";
  return "Today’s pick";
}

const SB_CLOCK = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});

function clockParts(iso: string): { time: string; period: string } {
  const parts = SB_CLOCK.formatToParts(new Date(iso));
  const val = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? "";
  const hour = val("hour");
  const minute = val("minute");
  return {
    time: minute === "00" ? hour : `${hour}:${minute}`,
    period: val("dayPeriod"),
  };
}

const SB_YMD = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Hero meta time, e.g. `4–6 PM`. Empty when the pick has no start time
 *  (evergreen places, recurring items — venue then stands alone). */
export function heroTime(t: Thing): string {
  if (!t.starts_at) return "";
  const s = clockParts(t.starts_at);
  if (!t.ends_at) return `${s.time} ${s.period}`;
  // Multi-day span: a clock range would be nonsense — show the start only.
  if (SB_YMD.format(new Date(t.starts_at)) !== SB_YMD.format(new Date(t.ends_at)))
    return `${s.time} ${s.period}`;
  const e = clockParts(t.ends_at);
  return s.period === e.period
    ? `${s.time}–${e.time} ${e.period}`
    : `${s.time} ${s.period}–${e.time} ${e.period}`;
}

/** Card CTA affordance: ticketing handoffs get "Get tickets", else "See details".
 *  Rendered as text inside the card's single tap target — never a nested link. */
export function heroCta(t: Thing): string {
  const url = (t.buy_url ?? "").toLowerCase();
  const ticketing = url.includes("axs") || url.includes("ticketmaster");
  return ticketing ? "Get tickets ↗" : "See details ↗";
}
