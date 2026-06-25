// lib/review.ts
//
// Shared data shapes + PURE helpers for the review cockpit (/admin/review).
// No server-only imports here — client components import these formatters, so
// keep next/headers + service-role code in lib/reviewServer.ts.

export type ChipKind = "green" | "amber" | "evergreen";

export interface PhotoOption {
  url: string;
  source: string; // pexels | wikimedia | google | owned | placeholder
  attribution?: string;
}

export interface QueueRow {
  id: string;
  type: string;
  title: string;
  blurb: string | null;
  happening_category: string | null;
  happening_tier: number;
  neighborhood: string | null;
  address: string | null;
  price_band: string | null;
  free: boolean | null;
  starts_at: string | null;
  source: string | null; // the source URL (provenance + uuid5 key)
  photo_url: string | null;
  photo_source: string | null;
  photo_options: PhotoOption[];
  tags: string[];
  when: string; // pre-formatted mono string
  chip: ChipKind;
}

export interface DropRow {
  id: number;
  source: string;
  title: string | null;
  reason: string;
  detail: string | null;
  source_url: string | null;
}

export interface SourceRow {
  source: string;
  landed: number;
  fetched: number;
  ok: boolean;
  status: "ok" | "warn" | "fail";
}

const TZ = "America/Los_Angeles";
const whenFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ, weekday: "short", month: "short", day: "numeric",
  hour: "numeric", minute: "2-digit", hour12: true,
});

/** "Thu, Jul 9 · 7:00 PM" in SB local time. */
export function sbWhen(iso: string): string {
  const parts = whenFmt.formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const wd = get("weekday"), mo = get("month"), d = get("day");
  const h = get("hour"), m = get("minute"), ap = get("dayPeriod");
  return `${wd} ${mo} ${d} · ${h}:${m} ${ap}`;
}

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORD = ["", "1st", "2nd", "3rd", "4th"];
function hhmm(t: string | null): string {
  if (!t) return "";
  const [h, m] = t.split(":");
  const hr = Number(h) % 12 || 12;
  const ap = Number(h) < 12 ? "AM" : "PM";
  return `${hr}:${m}${ap === "AM" ? "a" : "p"}`;
}

interface Sched {
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  frequency: string | null;
  label: string | null;
}

/** Trust chip from what's actually stored (tier + starts_at). */
export function chipFor(tier: number, starts_at: string | null): ChipKind {
  if (tier === 3) return "evergreen";
  return starts_at ? "green" : "amber";
}

export function chipLabel(chip: ChipKind): string {
  return chip === "green" ? "Deterministic start" : chip === "amber" ? "Confirm cadence" : "Evergreen";
}

/** The mono "when" string: dated start, recurring cadence, or evergreen. */
export function whenString(tier: number, starts_at: string | null, scheds: Sched[]): string {
  if (starts_at) return sbWhen(starts_at);
  if (tier === 3) return "Evergreen · open daily";
  const s = scheds[0];
  if (!s) return "Recurring · time TBD";
  if (s.label) return s.label;
  const day = s.day_of_week != null ? DOW[s.day_of_week] : "";
  const time = [hhmm(s.start_time), hhmm(s.end_time)].filter(Boolean).join("–");
  if (s.frequency === "monthly") return `1st ${day}/month · ${time}`.trim();
  if (s.frequency === "biweekly") return `Biweekly ${day} · ${time}`.trim();
  return `${day} · ${time}`.trim();
}

/** Doc 11 §9 order: dated rows by soonest start, then start-less (T3) by newest. */
export function prioritize<T extends { starts_at: string | null }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    if (a.starts_at && b.starts_at) return a.starts_at.localeCompare(b.starts_at);
    if (a.starts_at) return -1;
    if (b.starts_at) return 1;
    return 0; // both start-less — keep DB order (fetched newest-first)
  });
}

/** Latest run per source -> a green/amber/red health row. */
export function rollupSources(
  runs: { source: string; landed: number; fetched: number; ok: boolean; started_at: string }[],
): SourceRow[] {
  const latest = new Map<string, (typeof runs)[number]>();
  for (const r of runs) {
    const prev = latest.get(r.source);
    if (!prev || r.started_at > prev.started_at) latest.set(r.source, r);
  }
  return [...latest.values()].map((r) => ({
    source: r.source,
    landed: r.landed,
    fetched: r.fetched,
    ok: r.ok,
    status: !r.ok ? "fail" : r.landed > 0 ? "ok" : "warn",
  }));
}
