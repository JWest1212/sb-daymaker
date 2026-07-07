// lib/edition/emdash.ts
//
// Hard rule (copy_kit_v2 §0): em dashes never appear anywhere in the digest,
// including reused fields that were AI-drafted upstream. The drafter's own
// authored strings (subject/preheader/greeting) are normalized at write time
// (belt); the renderer (Phase 6) runs this same pass over every assembled
// string, including reused blurbs, as the final normalization (suspenders).

const EM_DASH = /\s*—\s*/g;

/** Strips em dashes from a string, substituting a comma (a safe default per
 *  copy_kit_v2 §0.2 — "period, comma, colon, semicolon, or parentheses
 *  instead"), then collapses any resulting double-spacing. */
export function stripEmDashes(input: string): string {
  return input.replace(EM_DASH, ", ").replace(/ {2,}/g, " ").trim();
}
