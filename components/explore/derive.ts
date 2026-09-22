import type { Thing } from "@/lib/things";
import type { Weather } from "@/lib/weather";
import { OCCASION_BY_KEY } from "@/lib/occasions";
import type { TagColor } from "@/components/ui/Chip";
import type { CardVisual } from "@/components/ui/Card";
import { eventCardWhen, eventDateWithYear } from "@/lib/format/eventTime";
import { areaShortForThing } from "@/lib/areas";
import { hasEnded } from "@/lib/poolFilter";
import { isTicketingUrl } from "@/lib/format/outboundLink";
import { nextOccurrenceForThing, formatNextDate } from "@/lib/recurring/nextOccurrence";

/** Shared by Hero (sky variant) and the R1 "Today's pick" card's contextual
 *  eyebrow (heroEyebrow below), moved here so both can import one definition. */
/** Conditions that are gray whatever else is true. */
const GRAY_CONDITIONS = ["rain", "drizzle", "thunderstorm", "snow", "fog", "mist", "haze", "smoke", "squall"];
/** Cloud cover heavy enough to call the day gray (OpenWeather 51%+). */
const GRAY_CLOUDS = ["overcast", "broken"];
/** Cloud cover that is just a nice day with clouds in it (OpenWeather 11-50%). */
const BRIGHT_CLOUDS = ["few", "scattered", "partly"];

/**
 * R1 W2.5 (TP-C8-03). Is it actually a gray day?
 *
 * This used to return true for ANY condition containing "cloud", so a partly
 * cloudy 74-degree afternoon counted as gray, and because "Gray day move" is the
 * first branch of heroEyebrow it pre-empted every other label. Every pick on
 * every cloudy day was a "Gray day move", which on a 74-degree day disagrees
 * with the weather chip sitting right next to it.
 *
 * Rain, fog and their relatives are gray. Cloud cover is gray only when it is
 * heavy (overcast or broken). Few, scattered and partly cloudy are not, and when
 * the description says nothing useful the answer is "not gray", because
 * overclaiming is the failure this fixes.
 */
export function isGrayDay(weather: Weather | null): boolean {
  if (!weather || weather.isClear) return false;
  const cond = (weather.condition ?? "").toLowerCase();
  const desc = (weather.description ?? "").toLowerCase();
  if (GRAY_CONDITIONS.some((c) => cond.includes(c) || desc.includes(c))) return true;
  if (cond.includes("cloud") || desc.includes("cloud")) {
    if (BRIGHT_CLOUDS.some((d) => desc.includes(d))) return false;
    return GRAY_CLOUDS.some((d) => desc.includes(d));
  }
  return false;
}

/** R1 W2.5. Somewhere the weather cannot spoil. "both" counts: a place that
 *  works indoors is a fine answer to a wet afternoon. */
export function worksIndoors(t: Thing): boolean {
  if (t.setting) return t.setting === "indoor" || t.setting === "both";
  return t.indoor;
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

/** R1 W4.1/W5.1. The card's place line: the venue when we lifted one out of the
 *  title, otherwise the area. Never the raw enum, never "other". */
export function cardPlace(t: Thing): string | undefined {
  if (t.venue_name?.trim()) return t.venue_name.trim();
  return areaShortForThing(t) ?? undefined;
}

/** R1 W5.5 (DET-011). What a card says about price. `price_note` is the written
 *  version ("$15 to $25", "Free, RSVP") and wins when present; the band is the
 *  fallback; nothing renders blank. */
export function priceLabel(t: Thing): string {
  if (t.price_note?.trim()) return t.price_note.trim();
  if (t.free) return "Free";
  if (t.price_band) return t.price_band;
  return "Check site";
}

export function cardFacts(t: Thing): string[] {
  const facts: string[] = [];
  facts.push(priceLabel(t));
  // G0.3, the exact time, via the one shared formatter the detail page also uses.
  // Previously this dropped minutes ("Fri 8 PM"), disagreeing with the detail's
  // "8:30 PM". Now both build the clock token from eventClock().
  if (t.type === "event" && t.starts_at) facts.push(eventCardWhen(t.starts_at));
  if (t.is_21_plus) facts.push("21+");
  return facts;
}

export function cardBlurb(t: Thing): string {
  return t.blurb ?? t.reason_to_go ?? "";
}

/** Elevation v1 · Gate 3 · G3.4, the "when" for a recurring (Tier-2) card: a real
 *  next date ("Next: Fri Jul 24, 5pm"), or an honest "Check schedule" for an
 *  irregular cadence, never a false "every week". Null for non-recurring things
 *  (callers fall back to cardFacts). Computed read-time so it's never stale. */
export function recurringWhen(t: Thing): string | null {
  if (t.happening_tier !== 2 || t.recurring.length === 0) return null;
  const next = nextOccurrenceForThing(
    t.recurring.map((r) => ({
      day_of_week: r.day_of_week,
      cadence: r.cadence,
      frequency: r.frequency,
      nth_dow: r.nth_dow,
      start_time: r.start_time,
      last_confirmed: r.last_confirmed,
    })),
  );
  if (next === null) return null;
  if (next === "irregular") return "Check schedule";
  return `Next: ${formatNextDate(next)}`;
}

/** Card Imagery Build Spec Phase 3 §6.2, `ListCard`'s motif/bigtype render input,
 *  assembled from the fields `resolveImages()` already wrote. `undefined` when the
 *  thing has no visual assigned (a real photo, or a row that predates Phase 3's
 *  backfill), `ListCard` falls through to the pre-existing gradient in that case. */
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
// bucket, the spec's wireframe shorthand (music/arts/happyhour) mapped onto the
// real categories the pipeline actually writes.
const MUSIC_CATS = new Set(["live_music"]);
const ARTS_CATS = new Set(["arts_theater", "recurring_arts"]);

/**
 * Context-aware eyebrow for the hero pick. First match wins (spec §2.2.1).
 * Keys off the site's true enums: `happening_category` for the music/arts
 * buckets, and the `happyhour` thing `type` (there is no happy-hour category).
 */
export function heroEyebrow(t: Thing, grayDay: boolean): string {
  // R1 W2.5. Only a genuinely gray day, and only when the pick is somewhere the
  // weather cannot spoil. Calling an outdoor pick a "Gray day move" is worse
  // than saying nothing: it recommends the one thing the weather rules out.
  if (grayDay && worksIndoors(t)) return "Gray day move";
  if (t.type === "place") return "Local favorite"; // R1 W8.1: "Place" retired from UI copy
  if (t.free) return "Free"; // was "Free · Today" on every horizon, Month included
  const cat = t.happening_category ?? "";
  if (MUSIC_CATS.has(cat)) return "Catch a Show";
  if (ARTS_CATS.has(cat)) return "Arts & Culture"; // R1 W8.1 (XC-006), one label
  if (t.type === "happyhour") return "Happy Hour";
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

/** Hero meta time, e.g. `4-6 PM`. Empty when the pick has no start time
 *  (evergreen places, recurring items, venue then stands alone). */
export function heroTime(t: Thing): string {
  if (!t.starts_at) return "";
  const s = clockParts(t.starts_at);
  if (!t.ends_at) return `${s.time} ${s.period}`;
  // Multi-day span: a clock range would be nonsense, show the start only.
  if (SB_YMD.format(new Date(t.starts_at)) !== SB_YMD.format(new Date(t.ends_at)))
    return `${s.time} ${s.period}`;
  const e = clockParts(t.ends_at);
  return s.period === e.period
    ? `${s.time}-${e.time} ${e.period}`
    : `${s.time} ${s.period}-${e.time} ${e.period}`;
}

/** Card CTA affordance: ticketing handoffs get "Get tickets", else "See details".
 *  Rendered as text inside the card's single tap target, never a nested link. */
export function heroCta(t: Thing): string {
  // Shared ticketing-host definition (G5.7), so cards and the detail row agree.
  return isTicketingUrl(t.buy_url) ? "Get tickets ↗" : "See details ↗";
}

/** R1 W2.2 (SHR-002, past part). One wording for "this already happened",
 *  shared by the Saved card, the shared-list recipient page and the restore
 *  recipient page, so a past item is marked identically wherever it turns up.
 *  Null when the thing is not archived (or has no date to name). */
/** R1 W7.3. The one "is this in the past?" rule: archived, or a dated event
 *  that is over. The cards, the detail banner and the restore page all use it. */
export function isOver(t: Thing, nowMs: number): boolean {
  return t.status === "archived" || (t.type === "event" && hasEnded(t, nowMs));
}

export function alreadyHappenedLine(t: Thing, nowMs?: number): string | null {
  // R1 W7.3 (SHR-002). Archived, OR a dated event that is over. Status alone
  // left a week-long gap: a finished event stays "published" until the retire
  // job archives it seven days later, and the audit's shared link showed two
  // last-Monday events with no sign they had happened. `nowMs` comes from the
  // caller (the server, or the page's mount snapshot) so server and client agree.
  const over = nowMs != null ? isOver(t, nowMs) : t.status === "archived";
  if (!over) return null;
  return t.starts_at ? `Already happened, ${eventDateWithYear(t.starts_at)}` : "Already happened";
}

/**
 * R1 W5.7 (A11Y-005). Alt text for a listing's photograph: the title, plus the
 * venue when we know one.
 *
 * Card images carried `alt=""`, which tells a screen reader the image is
 * decorative. On a card it is not: it is the only picture of the thing being
 * recommended. The skyline and the generated category motifs genuinely ARE
 * decorative and keep `alt=""`, because describing them would add noise without
 * adding information.
 */
export function imageAlt(t: Thing): string {
  return t.venue_name?.trim() ? `${t.title} at ${t.venue_name.trim()}` : t.title;
}

/**
 * R1 W6.4 (EXP-025/EXP-026). The card's meta line, in ONE fixed order:
 *
 *   [Short area] · [Tue 7 PM] · [price]
 *
 * Every horizon uses this, so a card means the same thing wherever it appears.
 * Before this, Today, Week and Month each assembled their own line in their own
 * order, and the Month view used a different card entirely.
 *
 * A slot with nothing to say is dropped rather than rendered as a bare
 * separator (EXP-030, G0.7).
 */
export function cardMeta(t: Thing): string {
  const when =
    t.type === "event" && t.starts_at
      ? eventCardWhen(t.starts_at)
      : recurringWhen(t) ?? undefined;
  return [areaShortForThing(t), when, priceLabel(t)].filter(Boolean).join(" · ");
}

/**
 * R1 W6.4 (D6). The meta line for a collapsed series card: the cadence and the
 * next date, e.g. "Funk Zone · Every Sunday, next Sep 27 · Free".
 */
export function seriesMeta(t: Thing, cadence: string | null, nextStart: string | null): string {
  const when = cadence
    ? nextStart
      ? `${cadence}, next ${SERIES_NEXT_FMT.format(new Date(nextStart))}`
      : cadence
    : nextStart
      ? eventCardWhen(nextStart)
      : undefined;
  return [areaShortForThing(t), when, priceLabel(t)].filter(Boolean).join(" · ");
}

const SERIES_NEXT_FMT = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Los_Angeles",
  month: "short",
  day: "numeric",
});
