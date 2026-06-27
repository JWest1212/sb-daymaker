import type { NextConfig } from "next";

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

export default nextConfig;
