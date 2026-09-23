import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { execFileSync } from "node:child_process";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(self)",
  },
];

const nextConfig: NextConfig = {
  async headers() {
    const rules = [{ source: "/:path*", headers: securityHeaders }];
    // Dev only: Turbopack chunk URLs are stable and the dev server returns a
    // stale ETag, so browsers revalidate, get 304s, and keep old CSS/JS. Tell
    // the browser never to store dev static assets so it always refetches.
    if (process.env.NODE_ENV !== "production") {
      rules.push({
        source: "/_next/static/:path*",
        headers: [{ key: "Cache-Control", value: "no-store, must-revalidate" }],
      });
    }
    return rules;
  },
};

/**
 * R1 W8.4 (D9, DSC-002). The dash policy is a BUILD failure, not a lint note.
 *
 * scripts/check-emdash.mjs already existed, but only `npm run lint` ran it, and
 * nothing runs lint before a deploy. Hooking it to the production-build phase
 * here means `next build` itself fails on a U+2014 or U+2013 in app, components,
 * lib, ingest or scripts, however the build is started (locally, `npm run
 * build`, or Vercel's default `next build`). The env flag stops the check from
 * re-running in the build's worker processes, which load this file too.
 */
export default function config(phase: string): NextConfig {
  if (phase === PHASE_PRODUCTION_BUILD && !process.env.SBD_DASH_CHECKED) {
    execFileSync(process.execPath, ["scripts/check-emdash.mjs"], { stdio: "inherit" });
    process.env.SBD_DASH_CHECKED = "1";
  }
  return nextConfig;
}
