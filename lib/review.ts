// lib/review.ts
//
// Shared data shapes + PURE helpers for the review cockpit (/admin/review).
// No server-only imports here — client components import these formatters, so
// keep next/headers + service-role code in lib/reviewServer.ts.

export type ChipKind = "green" | "amber" | "evergreen";

/** The valid neighborhood + occasion-tag vocabularies (for the inline editor). */
export const NEIGHBORHOODS = [
  "funk_zone", "downtown", "waterfront", "montecito", "mesa",
  "mission_canyon", "riviera", "upper_state", "goleta", "carpinteria", "other",
] as const;

export const OCCASION_TAGS = [
  "date_night", "family_day", "nightlife", "catch_a_show", "arts_culture",
  "outdoors_active", "wine_food", "free_sb", "hosting_visitors", "solo",
] as const;

/** Negative-rule filter for founder-edited tags (mirrors enrich.ts / schema B4). */
export function filterTags(
  tags: string[],
  opts: { is_21_plus?: boolean | null; price_band?: string | null },
): string[] {
  let out = tags.filter((t) => (OCCASION_TAGS as readonly string[]).includes(t));
  if (opts.is_21_plus) out = out.filter((t) => t !== "family_day");
  if (opts.price_band != null && opts.price_band !== "free") out = out.filter((t) => t !== "free_sb");
  return [...new Set(out)];
}

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
  blurb_long: string | null;
  happening_category: string | null;
  happening_tier: number;
  neighborhood: string | null;
  address: string | null;
  price_band: string | null;
  free: boolean | null;
  is_21_plus: boolean | null;
  starts_at: string | null;
  source: string | null; // the source URL (provenance + uuid5 key)
  photo_url: string | null;
  photo_source: string | null;
  photo_options: PhotoOption[];
  tags: string[];
  when: string; // pre-formatted mono string
  chip: ChipKind;
  /** Set when this is a registry-candidate rhythm (§3.5). Contains the ready-to-paste
   *  TypeScript snippet the founder adds to recurringRegistry.ts. Never auto-published. */
  registrySnippet?: string;
}

/** The editable draft held while a card is in Edit mode. */
export interface ReviewDraft {
  blurb: string;
  blurb_long: string;
  neighborhood: string;
  tags: string[];
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
  const time = [hhmm(s.start_time), hhmm(s.end_time)].filter(Boolean).join("–") || "time TBD";
  if (s.label) return s.label.includes("TBD") || s.start_time ? s.label : `${s.label} · ${time}`;
  const day = s.day_of_week != null ? DOW[s.day_of_week] : "";
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

// Known source-URL patterns that identify registry-proposal adapters (§3.4).
// Items whose source URL matches these are shown as registry proposals in the
// cockpit (paste snippet instead of publish). Extend as new registry adapters land.
export const REGISTRY_SOURCE_PATTERNS = [
  /sbfarmersmarket\.org/i,
  /libcal\./i,            // LibCal (library recurring programs)
  /goleta.*library/i,
];

export function isRegistryProposalSource(source: string | null): boolean {
  if (!source) return false;
  return REGISTRY_SOURCE_PATTERNS.some((p) => p.test(source));
}

interface RegistrySchedRow {
  day_of_week: number | null;
  start_time: string | null;
  end_time: string | null;
  frequency: string | null;
}

const DOW_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Build the paste-ready TypeScript snippet for a registry-candidate item.
 * The founder pastes this into recurringRegistry.ts. (§3.5)
 */
export function buildRegistrySnippet(
  item: {
    title: string;
    address: string | null;
    neighborhood: string | null;
    happening_category: string | null;
    source: string | null;
    tags: string[];
  },
  scheds: RegistrySchedRow[],
): string {
  const s = scheds[0];
  if (!s) return '// no schedule data available';

  const daysOfWeek = scheds
    .map((r) => r.day_of_week)
    .filter((d): d is number => d != null);

  const escapedTitle = item.title.replace(/'/g, "\\'");
  const venuePart = (item.address ?? '').split(',')[0].trim();
  const escapedVenue = venuePart.replace(/'/g, "\\'");

  const lines = [
    `{`,
    `  title: '${escapedTitle}',`,
    `  venueName: '${escapedVenue}',`,
    item.neighborhood ? `  neighborhood: '${item.neighborhood}',` : `  // neighborhood: '???',`,
    `  category: '${item.happening_category ?? 'recurring_market'}',`,
    `  frequency: '${s.frequency ?? 'weekly'}',`,
    `  daysOfWeek: [${daysOfWeek.join(', ')}],`,
    s.start_time ? `  startTime: '${s.start_time}',` : `  // startTime: '??:??',  // verify`,
    s.end_time   ? `  endTime: '${s.end_time}',`   : '',
    item.tags.length ? `  occasionTags: [${item.tags.map((t) => `'${t}'`).join(',')}],` : '',
    item.source ? `  sourceUrl: '${item.source}',` : '',
    `},`,
  ].filter((l) => l !== '').join('\n');

  return lines;
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
