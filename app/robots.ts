import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://sb-daymaker.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/cockpit", "/api", "/s/", "/r/", "/confirm", "/unsubscribe", "/offline"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
