// lib/edition/copyPools.ts
//
// The real subject/preheader/greeting pools from edition_copy_kit_v2.md §2-4,
// verbatim, plus the deterministic selection mechanism (§1 / anatomy v3 §4):
// index = stableHash(edition_id) % eligible_pool.length. No randomness, no
// model call, same issue, same line, every render.
//
// Eligibility (copy_kit_v2 §1): [safe] lines always qualify UNLESS the hero is
// an evergreen fallback, in which case ONLY [evergreen] lines are eligible (we
// never want a quiet week reading like a marquee-event promise). [token] lines
// additionally require every token they reference to resolve, and, per the
// {pick_count} note (§7), a line referencing {pick_count} drops out once that
// count falls to 1 or 0 ("and 2 more" reads fine; "and 0 more" doesn't).

import type { EditionType } from "./types";
import { stripEmDashes } from "./emdash";

export type PoolTag = "token" | "safe" | "evergreen";
export interface PoolLine {
  text: string;
  tags: PoolTag[];
}

export interface CopyContext {
  hero_title: string | null;
  hero_neighborhood: string | null;
  hero_when: string | null;
  edition_weekday: string;
  window_label: string;
  pick_count: number;
  heroIsEvergreen: boolean;
}

const L = (text: string, ...tags: PoolTag[]): PoolLine => ({ text, tags });

export const SUBJECT_POOLS: Record<EditionType, PoolLine[]> = {
  weekend: [
    L("This weekend: {hero_title}", "token"),
    L("{hero_title}, and {pick_count} more worth it", "token"),
    L("If you do one thing this weekend: {hero_title}", "token"),
    L("Start in {hero_neighborhood} this weekend", "token"),
    L("Worth leaving the house for: {hero_title}", "token"),
    L("Your weekend in Santa Barbara", "safe"),
    L("A few things worth doing this weekend", "safe"),
    L("Here's the weekend", "safe"),
    L("The weekend, sorted", "safe"),
    L("A quiet one this weekend? Here's where we'd be", "evergreen"),
    L("Slow weekend, good options", "evergreen"),
    L("Nothing loud this weekend, but still worth getting out", "evergreen"),
  ],
  week_ahead: [
    L("The week ahead: {hero_title}", "token"),
    L("This week, start with {hero_title}", "token"),
    L("{hero_neighborhood}, and a few reasons to get out this week", "token"),
    L("Santa Barbara, Monday to Thursday", "safe"),
    L("Your week ahead in SB", "safe"),
    L("The week ahead, and where to wander", "safe"),
    L("A few things, and a corner of SB worth exploring", "safe"),
    L("Slower week, better excuses to get out", "safe", "evergreen"),
    L("This week: a corner of SB worth your time", "evergreen"),
    L("Nowhere to be? Somewhere to go.", "evergreen"),
  ],
};

export const PREHEADER_POOLS: Record<EditionType, PoolLine[]> = {
  weekend: [
    L("The Move, three more picks, and where to point your weekend.", "safe"),
    L("Our shortlist for the next three days.", "safe"),
    L("{hero_neighborhood} and a few more worth the trip.", "token"),
    L("Everything worth leaving the couch for, in one scroll.", "safe"),
    L("Hand-picked, no filler.", "safe"),
    L("A calmer one this week. Still worth it.", "evergreen"),
  ],
  week_ahead: [
    L("Your Monday to Thursday, plus somewhere worth exploring.", "safe"),
    L("A lighter week, and a corner of SB to wander.", "safe"),
    L("The week ahead, and a place worth the detour.", "safe"),
    L("What's on, and where to explore.", "safe"),
    L("Quieter days, good excuses to get out.", "evergreen"),
  ],
};

export const GREETING_POOLS: Record<EditionType, PoolLine[]> = {
  weekend: [
    L("Here's what's worth doing, {window_label}.", "token"),
    L("{hero_neighborhood} is where we'd start this weekend.", "token"),
    L("Three days ahead. Here's the shortlist.", "safe"),
    L("The good stuff for the weekend. No filler.", "safe"),
    L("A few things worth leaving the house for.", "safe"),
    L("Quieter weekend than most, but we found the good corners.", "evergreen"),
  ],
  week_ahead: [
    L("Here's the week ahead, and a corner of SB worth your time.", "safe"),
    L("Slower stretch of the week. Good time to explore.", "safe"),
    L("Monday through Thursday, plus somewhere to wander.", "safe"),
    L("{hero_neighborhood} is worth a look this week.", "token"),
    L("Not much on the calendar, which is the best time to get out.", "evergreen"),
  ],
};

// Neutral, always-safe last-resort text, used only if a pool is somehow
// exhausted of eligible lines (shouldn't happen; every pool carries [safe] or
// [evergreen] lines that need no token), so a bug never renders "{hero_title}".
const FALLBACK: Record<"subject" | "preheader" | "greeting", string> = {
  subject: "Santa Barbara, worth getting out for",
  preheader: "A few things worth doing, hand-picked.",
  greeting: "Here's what's worth doing.",
};

function tokensIn(text: string): string[] {
  return [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]);
}

function tokenValue(ctx: CopyContext, token: string): string | number | null {
  switch (token) {
    case "hero_title": return ctx.hero_title;
    case "hero_neighborhood": return ctx.hero_neighborhood;
    case "hero_when": return ctx.hero_when;
    case "edition_weekday": return ctx.edition_weekday;
    case "window_label": return ctx.window_label;
    case "pick_count": return ctx.pick_count;
    default: return null;
  }
}

export function isEligible(line: PoolLine, ctx: CopyContext): boolean {
  if (ctx.heroIsEvergreen) return line.tags.includes("evergreen");
  if (line.tags.includes("safe")) return true;
  if (line.tags.includes("token")) {
    const toks = tokensIn(line.text);
    if (toks.includes("pick_count") && ctx.pick_count < 2) return false;
    return toks.every((t) => {
      const v = tokenValue(ctx, t);
      return v !== null && v !== "";
    });
  }
  return false; // evergreen-only line, hero is not evergreen, excluded
}

function substitute(text: string, ctx: CopyContext): string {
  return text.replace(/\{(\w+)\}/g, (_, t) => {
    const v = tokenValue(ctx, t);
    return v === null ? "" : String(v);
  });
}

/** FNV-1a-style, deterministic, no Math.random, same edition_id always maps
 *  to the same index for a given pool length (spec's stableHash contract). */
export function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function resolveLine(pool: PoolLine[], editionId: string, ctx: CopyContext, fallback: string): string {
  const eligible = pool.filter((l) => isEligible(l, ctx));
  if (!eligible.length) return stripEmDashes(fallback);
  const line = eligible[stableHash(editionId) % eligible.length];
  return stripEmDashes(substitute(line.text, ctx));
}

export function resolveEditionCopy(editionId: string, editionType: EditionType, ctx: CopyContext) {
  return {
    subject: resolveLine(SUBJECT_POOLS[editionType], editionId, ctx, FALLBACK.subject),
    preheader: resolveLine(PREHEADER_POOLS[editionType], editionId, ctx, FALLBACK.preheader),
    greeting: resolveLine(GREETING_POOLS[editionType], editionId, ctx, FALLBACK.greeting),
  };
}
