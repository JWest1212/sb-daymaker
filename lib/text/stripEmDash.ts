// lib/text/stripEmDash.ts  (Gate 0 . G0.9 . THE GOLDEN RULE)
//
// The one shared em-dash normalizer, used at write time (ingest) and render time
// (card / detail / guide / email). No em dash (U+2014) may ever reach a user.
//
// This file references the character only via the \u2014 regex escape, never the
// literal glyph, so it (like every other source file) stays literally em-dash
// free. That lets the build-time gate (scripts/check-emdash.mjs) enforce "zero
// U+2014 literals in source" with no allowlist and no exceptions.
//
// Replacement: a numeric or time range becomes " to " (e.g. a "5" to "8pm" span
// renders "5 to 8pm"); anything else becomes a comma. Prefer recasting the copy
// upstream; this is the deterministic last resort.

const EM_DASH = /\u2014/;
const RANGE = /(\d)\s*\u2014\s*(\d)/g;
const SPACED = /\s*\u2014\s*/g;

export function hasEmDash(input: string): boolean {
  return EM_DASH.test(input);
}

/** Normalize a string so it contains no em dash. */
export function stripEmDash(input: string): string {
  return input
    .replace(RANGE, '$1 to $2')
    .replace(SPACED, ', ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Null-safe variant for the render/data-mapping layer: leaves null or undefined
 *  alone, only rewrites strings that actually contain an em dash. */
export function cleanText<T extends string | null | undefined>(value: T): T {
  return (typeof value === 'string' && EM_DASH.test(value) ? stripEmDash(value) : value) as T;
}
