import type { MetadataRoute } from "next";
import { getPublishedThings } from "@/lib/things";
import { getPublishedGuides } from "@/lib/guides";
import { SITE_URL, thingPath, guidePath } from "@/lib/seo/site";

// Elevation v1 · Gate 2 · G2.7, the sitemap: every published thing + guide slug
// and the core routes, with lastModified from updated_at. getPublishedThings
// already excludes quality_tier=3, so quarantined entries never enter the sitemap.

export const revalidate = 3600; // rebuild hourly

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [things, guides] = await Promise.all([getPublishedThings(), getPublishedGuides()]);

  const core: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/weekend`, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/discover`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/plan`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${SITE_URL}/saved`, changeFrequency: "monthly", priority: 0.3 },
  ];

  const guideEntries: MetadataRoute.Sitemap = guides
    .filter((g) => g.slug)
    .map((g) => ({
      url: `${SITE_URL}${guidePath(g)}`,
      lastModified: g.updated_at ? new Date(g.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.8,
    }));

  const thingEntries: MetadataRoute.Sitemap = things
    .filter((t) => t.slug)
    .map((t) => ({
      url: `${SITE_URL}${thingPath(t)}`,
      lastModified: t.updated_at ? new Date(t.updated_at) : undefined,
      changeFrequency: "weekly",
      priority: 0.6,
    }));

  return [...core, ...guideEntries, ...thingEntries];
}
