// lib/photoSize.ts  (Performance pass, 2026-09-22)
//
// Ask the photo host for the size a slot actually shows. The homepage was
// downloading 4.5 MB of images to show thumbnails: Google place photos arrive
// 1152px wide and Wikimedia files as full originals (one etching was 1.3 MB).
// Both hosts resize for free on request. Measured: a Google photo went from
// 703 KB to 138 KB (w480, WebP); the etching from 1.35 MB to 356 KB (500px).
//
// Anything we cannot resize safely is returned unchanged. Callers keep the
// original as a fallback (see usePhoto in components/ui/Card.tsx), so a resize
// that fails to load can never cost a card its photograph.

/** Where a photo is shown, and so how wide it needs to be at 2x density. */
export type PhotoSlot = "thumb" | "rail" | "card" | "hero";

// Wikimedia only serves a fixed ladder of thumbnail widths; others return 400.
const WIKI_WIDTH: Record<PhotoSlot, number> = { thumb: 250, rail: 330, card: 960, hero: 960 };
const GOOGLE_WIDTH: Record<PhotoSlot, number> = { thumb: 200, rail: 320, card: 720, hero: 800 };

const WIKI = /^(https:\/\/upload\.wikimedia\.org\/wikipedia\/[^/]+\/)(?:thumb\/)?([0-9a-f]\/[0-9a-f]{2}\/)([^/?#]+)(?:\/[^/?#]+)?(?:[?#].*)?$/i;
// Thumbnails of these formats come back as a different file type; leave them.
const WIKI_SKIP = /\.(svg|tiff?|pdf|djvu|webm|ogv|gif)$/i;

export function sizedPhoto(url: string | null | undefined, slot: PhotoSlot): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return url;
  }

  // Google (place photos and the older lh3/lh5 "p/" photos): the size lives
  // after the last "=". Replace it, and ask for WebP ("-rw").
  if (u.hostname.endsWith(".googleusercontent.com")) {
    const eq = url.lastIndexOf("=");
    const base = eq > url.indexOf(u.hostname) ? url.slice(0, eq) : url;
    return `${base}=w${GOOGLE_WIDTH[slot]}-rw`;
  }

  // Wikimedia Commons (and other Wikimedia projects' uploads).
  const m = url.match(WIKI);
  if (m && !WIKI_SKIP.test(m[3])) {
    const [, root, hash, file] = m;
    return `${root}thumb/${hash}${file}/${WIKI_WIDTH[slot]}px-${file}`;
  }

  return url;
}
