// lib/format/openNow.ts  (Elevation v1 · Gate 1 · G1.5, open-now, no live API)
//
// "Open now" computed from STORED hours, never a live Places lookup: the app is
// deterministic and runs on a fixed cost floor (CLAUDE.md §2). Hours live in the
// `things.hours` jsonb column as an array of {dow, open, close} in the venue's
// local (Santa Barbara) time. This module is pure; the client component reads the
// current SB weekday+minute and passes it in, so the string is stable per render.
//
// Unknown hours render NOTHING (never a guessed "open"). No em dash (Golden Rule).

export interface HourSpec {
  dow: number;   // 0 = Sunday … 6 = Saturday (schema convention)
  open: string;  // "HH:MM", 24h, SB-local
  close: string; // "HH:MM", 24h, SB-local; a value <= open means it closes after midnight
}

export type OpenState = "open" | "closed" | "unknown";

export interface OpenNow {
  state: OpenState;
  /** e.g. "Open until 5pm" / "Closed · opens 11am" / "Closed · opens Tue 11am". Null when unknown. */
  label: string | null;
}

const DOW_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function toMinutes(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 24 || min > 59) return null;
  return h * 60 + min;
}

/** "5pm" / "5:30pm" / "11am" from "HH:MM" (24h). Lowercase, no space, no dash. */
export function clockLabel(hhmm: string): string {
  const mins = toMinutes(hhmm);
  if (mins == null) return "";
  const total = mins % (24 * 60);
  const h24 = Math.floor(total / 60);
  const min = total % 60;
  const period = h24 < 12 || h24 === 24 ? "am" : "pm";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return min === 0 ? `${h12}${period}` : `${h12}:${String(min).padStart(2, "0")}${period}`;
}

/** Does an interval [open, close) contain `minute`, accounting for a window that
 *  runs past midnight (close <= open)? */
function within(open: number, close: number, minute: number): boolean {
  if (close > open) return minute >= open && minute < close;
  // Overnight window (e.g. 20:00 -> 02:00): open tonight OR before the close.
  return minute >= open || minute < close;
}

export interface SbNow {
  dow: number;    // 0-6
  minute: number; // minutes since SB-local midnight
}

/** Pure: given the stored hours and the current SB weekday+minute, resolve state
 *  and a compact label. Returns `unknown` (label null) when hours are absent. */
export function openStateAt(hours: HourSpec[] | null | undefined, now: SbNow): OpenNow {
  const valid = (hours ?? []).filter(
    (h) => toMinutes(h.open) != null && toMinutes(h.close) != null && h.dow >= 0 && h.dow <= 6,
  );
  if (valid.length === 0) return { state: "unknown", label: null };

  // Open right now? Check today's windows and yesterday's overnight spillover.
  for (const h of valid) {
    const open = toMinutes(h.open)!;
    const close = toMinutes(h.close)!;
    const spillsFromYesterday = close <= open && (h.dow + 1) % 7 === now.dow;
    if ((h.dow === now.dow || spillsFromYesterday) && within(open, close, now.minute)) {
      return { state: "open", label: `Open until ${clockLabel(h.close)}` };
    }
  }

  // Closed now: find the next opening (soonest today, else the next day forward).
  const todayLater = valid
    .filter((h) => h.dow === now.dow && toMinutes(h.open)! > now.minute)
    .sort((a, b) => toMinutes(a.open)! - toMinutes(b.open)!);
  if (todayLater.length > 0) {
    return { state: "closed", label: `Closed · opens ${clockLabel(todayLater[0].open)}` };
  }

  for (let step = 1; step <= 7; step++) {
    const d = (now.dow + step) % 7;
    const next = valid
      .filter((h) => h.dow === d)
      .sort((a, b) => toMinutes(a.open)! - toMinutes(b.open)!)[0];
    if (next) {
      return { state: "closed", label: `Closed · opens ${DOW_SHORT[d]} ${clockLabel(next.open)}` };
    }
  }

  return { state: "closed", label: "Closed" };
}

/** The current SB (America/Los_Angeles) weekday + minutes-since-midnight, for a
 *  given instant. Shared by the client component and tests (which pass a fixed ms). */
export function sbNowParts(ms: number): SbNow {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date(ms));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = DOW_SHORT.indexOf(get("weekday"));
  let hour = Number(get("hour"));
  if (hour === 24) hour = 0; // Intl can render midnight as "24" in some ICU builds
  const minute = hour * 60 + Number(get("minute"));
  return { dow: dow < 0 ? 0 : dow, minute };
}
