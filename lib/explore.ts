import type { Thing } from "./things";
import type { OccasionKey } from "./occasions";
import type { Zone } from "./zones";
import type { ActivityKey } from "./activities";

export type Horizon = "today" | "week" | "month";

// SB is always America/Los_Angeles; en-CA gives YYYY-MM-DD without extra config.
const SB_DATE_FMT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Los_Angeles",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The SB (America/Los_Angeles) calendar day for an instant, as "YYYY-MM-DD".
 *  The single source of truth for day-keying — reused by the coverage math so
 *  cockpit occurrence counts and the public feed can never disagree. */
export function sbDay(ms: number): string {
  return SB_DATE_FMT.format(ms);
}

/** Today's SB-local weekday as 0=Sun … 6=Sat (schema convention). Derived from
 *  the SB calendar date — NOT the browser's local `getDay()` — so a late-night
 *  user in another timezone still sees SB's day. Reuses `sbDay` (single source
 *  of truth) and reads the weekday off a UTC-anchored date to dodge DST drift,
 *  mirroring lib/occurrences.ts. */
export function sbDayOfWeek(now: number = Date.now()): number {
  const [y, m, d] = sbDay(now).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** Does a Tier-2 (recurring / happy-hour) thing land on today's SB weekday?
 *  A thing with NO schedule rows passes (we can't prove it's off-day — don't
 *  invent one). biweekly/monthly frequency is a deliberate approximation: a
 *  "1st Thursday" item shows on every Thursday. We do NOT expand occurrences
 *  here (that math is approximate too, and the feed must stay cheap +
 *  deterministic) — same feed-vs-coverage divergence lib/occurrences.ts notes. */
function tier2OccursToday(thing: Thing, now: number): boolean {
  const dow = sbDayOfWeek(now);
  const scheduleDows = [
    // Happy-hour windows only apply to happyhour things (empty otherwise).
    ...(thing.type === "happyhour" ? thing.happyHours.map((w) => w.day_of_week) : []),
    ...thing.recurring.map((s) => s.day_of_week),
  ];
  if (scheduleDows.length === 0) return true;
  return scheduleDows.includes(dow);
}

/** Happenings-first order: Tier 1 (dated) → 2 (recurring/HH) → 3 (evergreen).
 *
 *  W2.1a — the ranker now consumes `editorial_weight` (founder curation), the FIRST
 *  time cascade() reads a curation field. TRUST RULE (schema §A7, wave §0.3): this is
 *  explicitly-permitted founder curation. The sort key must NEVER read `is_featured`
 *  or `sponsor_id` — paid placement can never buy rank here. (A regression test in
 *  explore.test.ts sorts a fixture with those fields set adversarially and asserts the
 *  order is unchanged; keep it green.)
 *
 *  Per-tier deterministic key (no AI, no randomness):
 *   • All tiers: `editorial_weight < 0` sinks to the BOTTOM of its tier section —
 *     downweighted, never hidden (still visible + findable).
 *   • Tier-1, non-negative: starts_at asc (soonest-first legibility) → editorial_weight
 *     desc (same-start ties break toward founder-boosted) → stable input order.
 *   • Tier-2/3, non-negative: editorial_weight desc → stable input order (DB/alpha). */
export function cascade(things: Thing[]): Thing[] {
  return things
    .map((t, i) => [t, i] as const)
    .sort(([a, ia], [b, ib]) => {
      if (a.happening_tier !== b.happening_tier)
        return a.happening_tier - b.happening_tier;

      // Negatives sink within their tier section (both negative → keep relative order).
      const aNeg = a.editorial_weight < 0;
      const bNeg = b.editorial_weight < 0;
      if (aNeg !== bNeg) return aNeg ? 1 : -1;

      if (a.happening_tier === 1) {
        if (a.starts_at && b.starts_at && a.starts_at !== b.starts_at)
          return a.starts_at.localeCompare(b.starts_at);
        if (a.editorial_weight !== b.editorial_weight)
          return b.editorial_weight - a.editorial_weight; // secondary tie-break
      } else if (a.editorial_weight !== b.editorial_weight) {
        return b.editorial_weight - a.editorial_weight; // Tier-2/3 primary
      }

      return ia - ib; // stable input order
    })
    .map(([t]) => t);
}

/** W2.1a — the auto-hero pick, shared verbatim by BOTH the public ExploreClient hero
 *  memo and heroServer.ts's projected "Auto" rail so the two can never diverge. Pure,
 *  deterministic, sponsor-blind (reads only tier / starts_at / editorial_weight).
 *
 *  Rule: among Tier-1 items occurring TODAY (their SB starts_at day === sbTodayKey)
 *  with `editorial_weight > 0`, pick the highest weight; ties break to the soonest
 *  starts_at. If none qualify, fall back to `ordered[0]` (the pre-W2.1 behavior).
 *  `ordered` must already be cascade()-sorted. */
export function pickAutoHero(ordered: Thing[], sbTodayKey: string): Thing | null {
  const boostedToday = ordered.filter(
    (t) =>
      t.happening_tier === 1 &&
      t.editorial_weight > 0 &&
      t.starts_at != null &&
      sbDay(new Date(t.starts_at).getTime()) === sbTodayKey,
  );
  if (boostedToday.length > 0) {
    return boostedToday.reduce((best, t) => {
      if (t.editorial_weight !== best.editorial_weight)
        return t.editorial_weight > best.editorial_weight ? t : best;
      // tie on weight → soonest starts_at wins
      return (t.starts_at ?? "") < (best.starts_at ?? "") ? t : best;
    });
  }
  return ordered[0] ?? null;
}

/** Dated (Tier-1) events are bound by the horizon; ongoing items always pass.
 *  Date comparison uses the SB (Pacific) calendar day so yesterday's events
 *  don't bleed into today just because < 24 h has elapsed. */
export function withinHorizon(
  thing: Thing,
  horizon: Horizon,
  now: number = Date.now(),
): boolean {
  // W1.3a: on Today only, a recurring Tier-2 thing must actually occur today
  // (by SB weekday). Week/Month keep pass-all; Tier-3 is untouched everywhere.
  if (horizon === "today" && thing.happening_tier === 2) {
    return tier2OccursToday(thing, now);
  }
  if (thing.happening_tier !== 1 || !thing.starts_at) return true;
  const start = new Date(thing.starts_at).getTime();
  const todayKey = sbDay(now);
  const startKey = sbDay(start);
  if (startKey < todayKey) return false; // already passed in SB time
  if (horizon === "today") return startKey === todayKey;
  const days = (start - now) / 86_400_000;
  if (horizon === "week") return days < 7;
  return days < 31;
}

/** Days elapsed since Jan 1 of that year for an SB "YYYY-MM-DD" key (0-based). */
function dayOfYear(sbDateKey: string): number {
  const [y, m, d] = sbDateKey.split("-").map(Number);
  return Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / 86_400_000);
}

/** W1.3b Layer-1 — the hero's evergreen parachute (constraint C5). When the
 *  filtered view is empty, deterministically pick a Tier-3 thing from the full
 *  published pool, rotated by the SB calendar date: same day → same pick,
 *  tomorrow → the next one. No AI, no randomness. Returns null when the pool has
 *  no Tier-3 things — the caller then renders the hardcoded Layer-2 card. */
export function pickEvergreenFallback(things: Thing[], sbDateKey: string): Thing | null {
  const candidates = things
    .filter((t) => t.happening_tier === 3)
    .sort((a, b) => a.id.localeCompare(b.id));
  if (candidates.length === 0) return null;
  return candidates[dayOfYear(sbDateKey) % candidates.length];
}

export function filterByLens(things: Thing[], tag: OccasionKey | null): Thing[] {
  if (!tag) return things;
  return things.filter((t) => t.tags.includes(tag));
}

/** Home Rework spec §11.4 — the Activity door's filter, stacked with filterByLens.
 *  A thing with no activities (not yet enriched, or genuinely none) simply never
 *  matches a specific activity — same "no tag = no match" behavior as filterByLens. */
export function filterByActivity(things: Thing[], activity: ActivityKey | null): Thing[] {
  if (!activity) return things;
  return things.filter((t) => t.activities.includes(activity));
}

/** Stable sort that bubbles items in the chosen zone to the top. */
export function nearMeSort(things: Thing[], zone: Zone | null): Thing[] {
  if (!zone) return things;
  return things
    .map((t, i) => [t, i] as const)
    .sort((a, b) => {
      const na = a[0].nearby_zone === zone ? 0 : 1;
      const nb = b[0].nearby_zone === zone ? 0 : 1;
      return na - nb || a[1] - b[1];
    })
    .map((x) => x[0]);
}

export const TIER_META: Record<number, { key: string; title: string }> = {
  1: { key: "t1", title: "Happening soon" },
  2: { key: "t2", title: "On the regular" },
  3: { key: "t3", title: "Always worth it" },
};

// ---------------------------------------------------------------------------
// Lead-breakout helpers (Phase 16 — Explore horizon lead breakout)
// These do NOT modify cascade / withinHorizon / filterByLens.
// ---------------------------------------------------------------------------

export const SB_TZ = "America/Los_Angeles";

const SB_SHORT_DATE = new Intl.DateTimeFormat("en-US", {
  timeZone: SB_TZ,
  month: "short",
  day: "numeric",
});

/** Sort Tier-1 dated items by starts_at ascending (soonest first).
 *  Items without starts_at are placed last. */
export function byDateAsc(items: Thing[]): Thing[] {
  return [...items].sort((a, b) => {
    if (!a.starts_at && !b.starts_at) return 0;
    if (!a.starts_at) return 1;
    if (!b.starts_at) return -1;
    return a.starts_at.localeCompare(b.starts_at);
  });
}

/** Format a date range for the rock tile "when" pill.
 *  Single-day or null ends_at → "Jul 4". Multi-day → "Jul 17–18". */
export function formatWhen(
  starts_at: string | null,
  ends_at: string | null
): string {
  if (!starts_at) return "";
  const start = new Date(starts_at);
  const startLabel = SB_SHORT_DATE.format(start);
  if (!ends_at) return startLabel;
  const end = new Date(ends_at);
  if (sbDay(start.getTime()) === sbDay(end.getTime())) return startLabel;
  return `${startLabel}–${SB_SHORT_DATE.format(end)}`;
}

/** Group items by SB-local calendar day, days ascending, items in incoming order within each day. */
export function groupByDay(
  items: Thing[]
): Array<{ dayLabel: string; dateNum: number; items: Thing[] }> {
  const map = new Map<string, { dayLabel: string; dateNum: number; items: Thing[] }>();
  for (const t of items) {
    if (!t.starts_at) continue;
    const ms = new Date(t.starts_at).getTime();
    const key = sbDay(ms);
    if (!map.has(key)) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: SB_TZ,
        weekday: "short",
        day: "numeric",
      }).formatToParts(new Date(ms));
      const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((p) => p.type === type)?.value ?? "";
      map.set(key, {
        dayLabel: value("weekday").toUpperCase(),
        dateNum: parseInt(value("day"), 10),
        items: [],
      });
    }
    map.get(key)!.items.push(t);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

const UTC_LONG_MONTH = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  month: "long",
});

/** "5th" / "11th" / "22nd" — the standard English ordinal exceptions are the
 *  11th–13th (never "1st"/"2nd"/"3rd"). */
export function ordinal(day: number): string {
  if (day % 10 === 1 && day % 100 !== 11) return `${day}st`;
  if (day % 10 === 2 && day % 100 !== 12) return `${day}nd`;
  if (day % 10 === 3 && day % 100 !== 13) return `${day}rd`;
  return `${day}th`;
}

/** "July 5th through 11th" / "June 28th through July 4th" from UTC-anchored
 *  week bounds (see groupByWeek — these are synthetic calendar-math
 *  timestamps, not real instants, so they're formatted in UTC rather than
 *  SB_TZ). The month name repeats only when the week crosses a month. */
function formatWeekLabel(startMs: number, endMs: number): string {
  const start = new Date(startMs);
  const end = new Date(endMs);
  const startLabel = `${UTC_LONG_MONTH.format(start)} ${ordinal(start.getUTCDate())}`;
  const endLabel =
    start.getUTCMonth() === end.getUTCMonth()
      ? ordinal(end.getUTCDate())
      : `${UTC_LONG_MONTH.format(end)} ${ordinal(end.getUTCDate())}`;
  return `${startLabel} through ${endLabel}`;
}

/** Group items by SB-local calendar week (Sun–Sat), weeks ascending. Week bounds
 *  are computed via UTC-anchored date math off the SB day key (same DST-safe
 *  technique as dayOfYear above) so a late-night browser timezone can't shift
 *  the boundary. Items without starts_at can't be dated to a week — they're
 *  collected into a trailing, header-less group instead of being dropped. */
export function groupByWeek(
  items: Thing[]
): Array<{ weekKey: string; weekLabel: string | null; items: Thing[] }> {
  const map = new Map<string, { start: number; end: number; items: Thing[] }>();
  const undated: Thing[] = [];
  for (const t of items) {
    if (!t.starts_at) {
      undated.push(t);
      continue;
    }
    const [y, m, d] = sbDay(new Date(t.starts_at).getTime()).split("-").map(Number);
    const anchor = Date.UTC(y, m - 1, d);
    const start = anchor - new Date(anchor).getUTCDay() * 86_400_000;
    const end = start + 6 * 86_400_000;
    const weekKey = new Date(start).toISOString().slice(0, 10);
    if (!map.has(weekKey)) map.set(weekKey, { start, end, items: [] });
    map.get(weekKey)!.items.push(t);
  }
  const weeks: Array<{ weekKey: string; weekLabel: string | null; items: Thing[] }> = [
    ...map.entries(),
  ]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([weekKey, { start, end, items }]) => ({
      weekKey,
      weekLabel: formatWeekLabel(start, end),
      items,
    }));
  if (undated.length > 0) weeks.push({ weekKey: "undated", weekLabel: null, items: undated });
  return weeks;
}

/** A hand-spread "perfect day": one dated event + a few distinct evergreen places. */
export function pickPerfectDay(things: Thing[]): string[] {
  const ids: string[] = [];
  const event = things.find((t) => t.happening_tier === 1);
  if (event) ids.push(event.id);

  const seenCat = new Set<string>();
  for (const p of things) {
    if (ids.length >= 5) break;
    if (p.type !== "place") continue;
    const cat = p.happening_category ?? "";
    if (seenCat.has(cat)) continue;
    seenCat.add(cat);
    ids.push(p.id);
  }
  return ids.slice(0, 5);
}
