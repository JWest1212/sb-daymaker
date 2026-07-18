// lib/slug/makeSlug.ts  (Elevation v1 · Gate 2 · G2.1, semantic URL slugs)
//
// Deterministic, idempotent slugs for /thing and /discover URLs. Lowercase,
// diacritics stripped, ampersand spelled out, non-alphanumerics collapsed to
// single hyphens, trimmed, capped at a readable length on a word boundary. Pure,
// no I/O, so it runs identically in the backfill, the nightly publish path, and
// tests. No em dash anywhere (Golden Rule); the character can never enter a slug
// because everything outside [a-z0-9] becomes a hyphen.

const MAX_LEN = 60;
// U+0300..U+036F: combining diacritical marks left behind by NFKD. Built from a
// string so no combining glyph sits in this source file.
const COMBINING = new RegExp("[\\u0300-\\u036f]", "g");

/** The base slug for a title. Deterministic; the caller resolves collisions
 *  (see disambiguate). Falls back to "item" for an empty/symbol-only title so a
 *  slug is never the empty string. */
export function makeSlug(title: string): string {
  const base = (title ?? "")
    .normalize("NFKD")
    .replace(COMBINING, "")
    .replace(/&/g, " and ")
    .replace(/['’]/g, "") // drop apostrophes so "don't" -> "dont"
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-") // everything else -> hyphen
    .replace(/^-+|-+$/g, ""); // trim leading/trailing hyphens

  if (!base) return "item";

  // Cap length on a word (hyphen) boundary so the tail is never a truncated word.
  if (base.length <= MAX_LEN) return base;
  const cut = base.slice(0, MAX_LEN);
  const lastHyphen = cut.lastIndexOf("-");
  return (lastHyphen > 0 ? cut.slice(0, lastHyphen) : cut).replace(/-+$/g, "");
}

/** A short, stable disambiguator derived from a row's id (uuid). Used only when a
 *  base slug collides, so two rows with the same title still get unique, stable
 *  slugs (tied to the id, not to processing order). */
export function shortHash(id: string): string {
  const hex = (id ?? "").replace(/[^a-f0-9]/gi, "").toLowerCase();
  return hex.slice(0, 4) || "0000";
}

/** Resolve a base slug against the set of slugs already taken, returning a unique
 *  slug and NOT mutating the set (the caller adds it). Deterministic: first the
 *  bare base, then base + id-hash, then base + id-hash + a numeric bump (only if a
 *  hash somehow also collides). */
export function disambiguate(base: string, id: string, taken: Set<string>): string {
  if (!taken.has(base)) return base;
  const withHash = `${base}-${shortHash(id)}`;
  if (!taken.has(withHash)) return withHash;
  let n = 2;
  while (taken.has(`${withHash}-${n}`)) n++;
  return `${withHash}-${n}`;
}
