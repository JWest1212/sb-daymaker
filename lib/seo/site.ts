// lib/seo/site.ts  (Elevation v1 · Gate 2)
//
// One source of truth for the canonical site origin + absolute-URL building,
// used by metadata, JSON-LD, OG images, and the sitemap. Mirrors the value the
// root layout sets as metadataBase.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sbdaymaker.com").replace(/\/+$/, "");

/** Absolute URL for an app path ("/thing/the-lark" -> "https://.../thing/the-lark"). */
export function absoluteUrl(path: string): string {
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** The canonical path for a thing: its slug when set, else the id (pre-backfill). */
/** R1 W6.7 (DET-007). The id shape the DB hands out. A slug is lowercase words
 *  and hyphens, so the two can never be confused. Lives here, next to the path
 *  builders, because its only job is telling a canonical URL from a legacy one. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export function thingPath(t: { slug: string | null; id: string }): string {
  return `/thing/${t.slug ?? t.id}`;
}

/** The canonical path for a guide: its slug when set, else the id. */
export function guidePath(g: { slug: string | null; id: string }): string {
  return `/discover/${g.slug ?? g.id}`;
}
