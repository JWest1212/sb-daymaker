// lib/format/eventTime.ts  (Gate 0 · G0.3)
//
// ONE source of truth for how an event's time renders, so the Explore card and
// the detail page can never disagree (the "card says 8 PM, detail says 8:30 PM"
// bug: the card formatter dropped minutes). Both surfaces build their time token
// from eventClock(), so the clock string is byte-identical everywhere. No
// rounding, ever.
//
// Assembled from Intl.formatToParts (not a formatted template) because Node's
// ICU and the browser's disagree on separators, which would cause a React
// hydration mismatch on the client-rendered feed cards. Manual assembly yields
// the same string on server and client.

const TZ = "America/Los_Angeles";

const CLOCK = new Intl.DateTimeFormat("en-US", { timeZone: TZ, hour: "numeric", minute: "2-digit", hour12: true });
const WEEKDAY_SHORT = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "short" });
const WEEKDAY_LONG = new Intl.DateTimeFormat("en-US", { timeZone: TZ, weekday: "long" });
const MONTH_DAY = new Intl.DateTimeFormat("en-US", { timeZone: TZ, month: "short", day: "numeric" });

function only(fmt: Intl.DateTimeFormat, iso: string): string {
  // Single-field formatters render exactly one meaningful part; join non-literals.
  return fmt
    .formatToParts(new Date(iso))
    .filter((p) => p.type !== "literal")
    .map((p) => p.value)
    .join(" ");
}

/** The exact clock time, e.g. "8:30 PM" (or "8 PM" on the hour). No rounding. */
export function eventClock(iso: string): string {
  const parts = CLOCK.formatToParts(new Date(iso));
  const val = (type: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === type)?.value ?? "";
  const hour = val("hour");
  const minute = val("minute");
  const period = val("dayPeriod");
  return minute === "00" ? `${hour} ${period}` : `${hour}:${minute} ${period}`;
}

/** Compact card token: weekday + exact clock, e.g. "Fri 8:30 PM". */
export function eventCardWhen(iso: string): string {
  return `${only(WEEKDAY_SHORT, iso)} ${eventClock(iso)}`;
}

/** Detail token: full weekday + date + exact clock, e.g. "Friday, Aug 1, 8:30 PM".
 *  Shares eventClock() with the card, so the time portion is byte-identical. */
export function eventDetailWhen(iso: string): string {
  return `${only(WEEKDAY_LONG, iso)}, ${only(MONTH_DAY, iso)}, ${eventClock(iso)}`;
}
