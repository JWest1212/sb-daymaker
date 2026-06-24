import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sbdaymaker.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    { url: `${base}/discover`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/saved`, changeFrequency: "monthly", priority: 0.3 },
  ];
}
