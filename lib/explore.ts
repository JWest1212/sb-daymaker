import type { Thing } from "./things";
import type { OccasionKey } from "./occasions";
import type { Zone } from "./zones";

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

/** Happenings-first order: Tier 1 (dated) → 2 (recurring/HH) → 3 (evergreen).
 *  Within Tier 1, soonest first; otherwise keep input order (already tier-sorted). */
export function cascade(things: Thing[]): Thing[] {
  return [...things].sort((a, b) => {
    if (a.happening_tier !== b.happening_tier)
      return a.happening_tier - b.happening_tier;
    if (a.happening_tier === 1 && a.starts_at && b.starts_at)
      return a.starts_at.localeCompare(b.starts_at);
    return 0;
  });
}

/** Dated (Tier-1) events are bound by the horizon; ongoing items always pass.
 *  Date comparison uses the SB (Pacific) calendar day so yesterday's events
 *  don't bleed into today just because < 24 h has elapsed. */
export function withinHorizon(
  thing: Thing,
  horizon: Horizon,
  now: number = Date.now(),
): boolean {
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

export function filterByLens(things: Thing[], tag: OccasionKey | null): Thing[] {
  if (!tag) return things;
  return things.filter((t) => t.tags.includes(tag));
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
