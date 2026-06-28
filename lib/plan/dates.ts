// Small date helpers for the Plan surface, in Santa Barbara local time. Kept out
// of the pure engine (buildDay) so the engine stays time-independent; these are
// for the UI (the When question, the spine subline).

const SB_TZ = "America/Los_Angeles";

/** YYYY-MM-DD for "now" in Santa Barbara. */
export function todayISO(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SB_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Shift a YYYY-MM-DD by whole days (parsed as a plain calendar date, no tz drift). */
export function shiftISO(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** "SAT · JUN 27" style stamp for the spine subline (Phase 4). */
export function shortStamp(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const wd = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const mo = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${wd.toUpperCase()} · ${mo.toUpperCase()} ${d}`;
}

/** Weekday / day-of-month / month parts for a date chip (e.g. SAT · 28 · JUN). */
export function dayParts(iso: string): { wd: string; day: number; mon: string } {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return {
    wd: dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
    day: d,
    mon: dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" }),
  };
}

/** A full, screen-reader-friendly date label (e.g. "Saturday, June 28"). */
export function fullDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

/** The next `n` calendar days (YYYY-MM-DD) starting today, SB time. */
export function nextDays(n: number): string[] {
  const start = todayISO();
  return Array.from({ length: n }, (_, i) => shiftISO(start, i));
}

/** "Today" / "Tomorrow" / a short date for a chosen plan date. */
export function relativeLabel(iso: string): string {
  const t = todayISO();
  if (iso === t) return "Today";
  if (iso === shiftISO(t, 1)) return "Tomorrow";
  return shortStamp(iso);
}
