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
export function thingPath(t: { slug: string | null; id: string }): string {
  return `/thing/${t.slug ?? t.id}`;
}

/** The canonical path for a guide: its slug when set, else the id. */
export function guidePath(g: { slug: string | null; id: string }): string {
  return `/discover/${g.slug ?? g.id}`;
}
