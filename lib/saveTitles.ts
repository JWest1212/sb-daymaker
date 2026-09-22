// lib/saveTitles.ts  (R1 W7.4 · review fix)
//
// The title of every save, remembered on this device AT SAVE TIME, so the
// offline Saved list can always name what is on it. Saves themselves store only
// id and state (SavesProvider); before this, a title was only remembered once
// /saved had resolved the row online, so a visitor who hearted three things on
// the feed and then went offline saw three identical "This saved item" cards.
//
// Titles only: public listing names, never anything about the visitor.

export const TITLE_CACHE_KEY = "sbd.saves.titles.v1";

export function readSaveTitles(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(TITLE_CACHE_KEY) ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

export function rememberSaveTitles(entries: Iterable<{ id: string; title: string }>): void {
  try {
    const cache = readSaveTitles();
    let changed = false;
    for (const { id, title } of entries) {
      if (id && title && cache[id] !== title) {
        cache[id] = title;
        changed = true;
      }
    }
    if (changed) localStorage.setItem(TITLE_CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage blocked or full: the offline list falls back to a generic label */
  }
}
