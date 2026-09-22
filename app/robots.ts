import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.sbdaymaker.com";

// R1 W7.8 (META-003, review fix). Search crawlers stay out of the three token
// routes, /s/, /p/ and /r/, which also carry noindex. Link-preview bots are let
// in on their own rules: they honour robots.txt, and a blanket disallow meant a
// shared day plan pasted into X, iMessage or Slack showed no card at all, which
// is the whole point of the per-page cards W7.8 added (META-001).
const PRIVATE = ["/admin", "/cockpit", "/api", "/confirm", "/unsubscribe", "/offline"];
const UNFURLERS = [
  "Twitterbot",
  "facebookexternalhit",
  "LinkedInBot",
  "Slackbot",
  "Slackbot-LinkExpanding",
  "Discordbot",
  "WhatsApp",
  "TelegramBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: UNFURLERS, allow: "/", disallow: PRIVATE },
      { userAgent: "*", allow: "/", disallow: [...PRIVATE, "/s/", "/p/", "/r/"] },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
