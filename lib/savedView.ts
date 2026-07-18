import type { Thing } from "./things";

/**
 * Pure, value-sensitive selectors for the Saved view.
 *
 * These exist so the Saved list derivations are testable *and* provably free of
 * the stale-memo class of bug: they take the saves **map** as an explicit
 * argument (never a closure over provider state), so a `want→been` flip, which
 * changes a value, not a key, is always reflected. See lib/savedView.test.ts.
 */

export type SavesMap = Record<string, "want" | "been">;

/** A dated event whose start has already passed relative to `nowMs`. */
export function isPastEvent(t: Thing, nowMs: number): boolean {
  return t.type === "event" && t.starts_at != null && new Date(t.starts_at).getTime() < nowMs;
}

/**
 * Saved things whose (defaulted) state matches `state`. A missing entry is
 * excluded; an explicit `"want"` is want (the `?? "want"` default is preserved
 * for saved ids). Order follows the `things` pool, as before.
 */
export function filterByState(things: Thing[], saves: SavesMap, state: "want" | "been"): Thing[] {
  return things.filter((t) => {
    const v = saves[t.id];
    if (v === undefined) return false; // not saved → excluded
    return (v ?? "want") === state;
  });
}

/** Split a list into not-yet-past vs. past dated events, against a fixed `nowMs`. */
export function splitPast(items: Thing[], nowMs: number): { current: Thing[]; past: Thing[] } {
  const current: Thing[] = [];
  const past: Thing[] = [];
  for (const t of items) {
    if (isPastEvent(t, nowMs)) past.push(t);
    else current.push(t);
  }
  return { current, past };
}

/**
 * Been-marked things present in the pool, in saves-key (save) order, matching
 * the "oldest → newest" order MemoryRecap expects.
 */
export function beenList(things: Thing[], saves: SavesMap): Thing[] {
  const byId = new Map(things.map((t) => [t.id, t]));
  const out: Thing[] = [];
  for (const id of Object.keys(saves)) {
    if (saves[id] === "been") {
      const t = byId.get(id);
      if (t) out.push(t);
    }
  }
  return out;
}
