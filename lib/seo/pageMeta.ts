import type { Metadata } from "next";

/**
 * R1 W7.8 (META-001). One way to write a page's metadata.
 *
 * Next merges metadata SHALLOWLY: a page that sets `title` but not `openGraph`
 * inherits the root layout's whole openGraph object, whose title is the bare
 * string "SB Daymaker". That is why every shareable link previewed as the same
 * card while the pages' own titles were specific and well written. This helper
 * always writes the page's own openGraph and twitter values, so the preview
 * says what the page says.
 */
export const SITE_NAME = "SB Daymaker";
const SUFFIX = ` · ${SITE_NAME}`;

export function pageMeta({
  title,
  description,
  path,
  ogTitle,
  noindex = false,
}: {
  /** The full <title>, suffix included, e.g. "Your Saved List · SB Daymaker". */
  title: string;
  description: string;
  /** Canonical path. Omit for token pages, which have no canonical. */
  path?: string;
  /** The preview title. Defaults to `title` without the site suffix, since
   *  og:site_name already carries it. */
  ogTitle?: string;
  noindex?: boolean;
}): Metadata {
  const og = ogTitle ?? (title.endsWith(SUFFIX) ? title.slice(0, -SUFFIX.length) : title);
  return {
    title,
    description,
    ...(path ? { alternates: { canonical: path } } : {}),
    openGraph: {
      title: og,
      description,
      siteName: SITE_NAME,
      type: "website",
      ...(path ? { url: path } : {}),
    },
    twitter: { card: "summary_large_image", title: og, description },
    ...(noindex ? { robots: { index: false, follow: false } } : {}),
  };
}
