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

// R1 W8.4 (D9). En dashes too. A digit range keeps a hyphen ("5\u20137 PM" ->
// "5-7 PM", "2026\u201327" -> "2026-27"). A range between named days or months
// reads "to" ("Monday \u2013 Friday" -> "Monday to Friday"). Any other en dash is
// a separator, not a range, and gets the same comma an em dash does: D9's "to"
// applied blindly would turn the live title "The Lost Weekend \u2013 The
// Photography of May Pang" into "The Lost Weekend to The Photography...".
const EN_DASH = /\u2013/;
const EN_NUMERIC = /(\d)\s*\u2013\s*(\d)/g;
const NAMED = "(?:Mon|Tue|Tues|Wed|Thu|Thur|Thurs|Fri|Sat|Sun)(?:day|nesday|rsday|urday)?|Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|June?|July?|Aug(?:ust)?|Sept?(?:ember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?";
const EN_NAMED_RANGE = new RegExp(`\\b(${NAMED})\\.?\\s*\u2013\\s*(${NAMED})\\b`, "gi");
const EN_SPACED = /\s*\u2013\s*/g;
// "10am\u20132pm", "7:30 PM \u2013 9 PM": a clock range reads "to".
const EN_TIME = /(\d(?::\d\d)?\s*(?:am|pm|a\.m\.|p\.m\.))\s*\u2013\s*(\d)/gi;

export function hasEmDash(input: string): boolean {
  return EM_DASH.test(input) || EN_DASH.test(input);
}

/** Normalize a string so it contains no em dash and no en dash. */
export function stripEmDash(input: string): string {
  return input
    .replace(EN_TIME, '$1 to $2')
    .replace(EN_NUMERIC, '$1-$2')
    .replace(EN_NAMED_RANGE, '$1 to $2')
    .replace(EN_SPACED, ', ')
    .replace(RANGE, '$1 to $2')
    .replace(SPACED, ', ')
    .replace(/ {2,}/g, ' ')
    .trim();
}

/** Null-safe variant for the render/data-mapping layer: leaves null or undefined
 *  alone, only rewrites strings that actually contain an em dash. */
export function cleanText<T extends string | null | undefined>(value: T): T {
  return (typeof value === 'string' && (EM_DASH.test(value) || EN_DASH.test(value)) ? stripEmDash(value) : value) as T;
}
