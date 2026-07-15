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
  /** Card Imagery Build Spec Phase 2 §5, Live-catalog follow-up (2026-07-10) — set
   *  ONLY for an option sourced from a venue's photo pool (google/wikimedia fetched
   *  via the venue system). Lets the apply route also approve the underlying
   *  venue_photos row (compliant refresh/fallback) instead of just writing a raw
   *  URL onto the thing. Undefined for every other source (pexels, a plain
   *  find-more-images result, owned, placeholder). */
  venuePhotoId?: string;
}

/** Jim (2026-07-11): retired sources must never appear as pickable candidates —
 *  Wikimedia / Google / owned only. Historical 'pexels' entries still survive in
 *  older rows' stored photo_options; strip them wherever options are served to a
 *  picker (ingest's rankOptions also scrubs them on every merge-and-persist, so
 *  touched rows clean themselves over time). */
export function dropRetiredPhotoOptions<T extends { source: string }>(options: T[]): T[] {
  return options.filter((o) => o.source !== "pexels");
}

/** Images desk — the auto-attach confidence floor, deliberately stricter than
 *  the Venues tab's "surface anything above zero for human review": an exact
 *  place_id hit (+100), or two name-pattern hits (+20), or one name hit plus a
 *  strong proximity bonus. A bare single name-substring hit (10) stays a
 *  suggestion, never an auto-attach. Lives here (client-safe) so the desk UI
 *  and the server routes share one number. */
export const STRONG_MATCH_SCORE = 20;

export interface QueueRow {
  id: string;
  type: string;
  title: string;
  blurb: string | null;
  blurb_long: string | null;
  happening_category: string | null;
  happening_tier: number;
  neighborhood: string | null;
  nearby_zone: string | null; // coarse zone (Coverage/Near Me); carried for v2 §A6
  address: string | null;
  price_band: string | null;
  free: boolean | null;
  is_21_plus: boolean | null;
  hero_eligible: boolean; // ⭑ hero-plan shortlist flag (Cockpit v2 §1.7)
  editorial_weight: number; // W2.1c founder ranking nudge (−5..+5)
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
  /** Set when this queue card is a pending edit of a LIVE thing (thing_edits overlay).
   *  overlay_id = the thing_edits row; edit_of = the live thing_id. The card shows a
   *  merged preview (live row + payload) and approve applies it to the live row. */
  overlay_id?: string;
  edit_of?: string;
}

/** A row in the Live catalog (published things). Carries the editable fields so
 *  the edit sheet can pre-fill without a second fetch. */
export interface CatalogRow {
  id: string;
  title: string;
  blurb: string | null;
  blurb_long: string | null;
  neighborhood: string | null;
  is_21_plus: boolean | null;
  happening_tier: number;
  nearby_zone: string | null;
  price_band: string | null;
  hero_eligible: boolean;
  editorial_weight: number; // W2.1c founder ranking nudge (−5..+5)
  photo_url: string | null;
  photo_source: string | null;
  /** Card Imagery — non-owned photo credit (Build Spec Phase 1 §4.3). */
  photo_attribution: string | null;
  /** Card Imagery — the resolver's ranked alternates, so the Live-catalog edit sheet
   *  can offer a photo picker without a second fetch. */
  photo_options: PhotoOption[];
  tags: string[];
  when: string;
  pending_edit: boolean; // an edit is awaiting review in the queue
  groupKey: string;      // day/bucket this row belongs to (for the divider grouping)
  groupLabel: string;    // header shown when the group changes ("Today · Thu, Jul 3", "Recurring…")
  /** Card Imagery Build Spec Phase 2 §5, Live-catalog follow-up (2026-07-10) —
   *  carried so the edit sheet's photo section knows whether this thing already
   *  has a venue (fetch reuses it) or would need one auto-created on first fetch,
   *  and whether there's a place_id/lat/lng to seed that venue with. */
  place_id: string | null;
  lat: number | null;
  lng: number | null;
  venue_id: string | null;
}

/** The editable draft held while a card is in Edit mode. Title is editable in v2
 *  (start time is not — reject & re-ingest to change a time). */
export interface ReviewDraft {
  title: string;
  blurb: string;
  blurb_long: string;
  neighborhood: string;
  tags: string[];
}

/** The optional edit payload the approve route applies before publishing (v2 §A5).
 *  Only the fields the founder changed need be present. */
export interface EditPayload {
  title?: string;
  blurb?: string | null;
  blurb_long?: string | null;
  neighborhood?: string | null;
  tags?: string[];
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
 * Build a copy-paste reference summary for a registry-candidate item — the
 * founder pastes these values into the "Add a rhythm" form at
 * /admin/coverage/recurring-rhythms, then rejects this card. (§3.5)
 * Plain "Field: value" lines, not code — the destination is a web form, not
 * a source file, since the Data Arch Redesign recurring-registry migration.
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
  if (!s) return 'no schedule data available';

  const daysOfWeek = scheds
    .map((r) => r.day_of_week)
    .filter((d): d is number => d != null)
    .map((d) => DOW_NAMES[d] ?? String(d));

  const venuePart = (item.address ?? '').split(',')[0].trim();

  const lines = [
    `Title: ${item.title}`,
    `Venue: ${venuePart}`,
    `Address: ${item.address ?? '(fill in)'}`,
    `Neighborhood: ${item.neighborhood ?? '(pick one)'}`,
    `Category: ${item.happening_category ?? 'recurring_market'}`,
    `Frequency: ${s.frequency ?? 'weekly'}`,
    `Day(s) of week: ${daysOfWeek.join(', ')}`,
    `Start time: ${s.start_time ?? '(unknown — leave blank, check "time TBD")'}`,
    s.end_time ? `End time: ${s.end_time}` : '',
    item.tags.length ? `Tags: ${item.tags.join(', ')}` : '',
    item.source ? `Source URL: ${item.source}` : '',
  ].filter((l) => l !== '');

  return lines.join('\n');
}

/** Data Arch Redesign 23 Phase 4 — a source's health judged against ITS OWN
 *  baseline (`sources.expected_yield`), never a global threshold. This is the
 *  fix for the exact gap `rollupSources()` above has: a source whose normal
 *  yield is 0 never false-alarms (no baseline yet = nothing to compare
 *  against), while a source that normally lands 20 and quietly drops to 1
 *  reads as a real problem instead of the old "warn"/"ok" global heuristic. */
export interface SourceHealthRow {
  key: string;
  label: string;
  status: string; // 'active' | 'paused' | 'retired' | 'candidate'
  expected_yield: number;
  last_yield: number | null;
  last_ok_at: string | null;
  consecutive_empty: number;
}

export type SourceHealth = "ok" | "below_baseline" | "paused";

/** "Materially below" baseline, per Doc 16 §3.9/§3.10 — a fraction, not a hard
 *  zero, so a source that normally lands 20 and drops to 2 still trips this
 *  even though 2 isn't literally zero. Sources with no established baseline
 *  yet (`expected_yield` 0) can never trip it — nothing to compare against. */
const BELOW_BASELINE_FRACTION = 0.34;

export function sourceHealth(s: Pick<SourceHealthRow, "status" | "expected_yield" | "last_yield">): SourceHealth {
  if (s.status !== "active") return "paused"; // covers 'paused' | 'retired' | 'candidate' alike
  if (s.expected_yield > 0 && (s.last_yield ?? 0) < s.expected_yield * BELOW_BASELINE_FRACTION) return "below_baseline";
  return "ok";
}

/** Sorts problems first: below-baseline, then paused, then healthy; each
 *  group by worst-first (fewest days of runway to auto-pause / lowest yield). */
export function rankSourceHealth(rows: SourceHealthRow[]): (SourceHealthRow & { health: SourceHealth })[] {
  const withHealth = rows.map((r) => ({ ...r, health: sourceHealth(r) }));
  const order: Record<SourceHealth, number> = { below_baseline: 0, paused: 1, ok: 2 };
  return withHealth.sort((a, b) => {
    const byGroup = order[a.health] - order[b.health];
    if (byGroup) return byGroup;
    if (a.health === "below_baseline") return b.consecutive_empty - a.consecutive_empty;
    return a.label.localeCompare(b.label);
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
