import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// This Next version uses the `proxy` file convention (formerly `middleware`).
// Two responsibilities, kept separate so listing requests never pay for the
// cockpit auth client:
//   1. Elevation v1 · Gate 2 · G2.2, 301 legacy /thing/<uuid> and /discover/<uuid>
//      paths (and Gate 0 merged-dupe paths) to their canonical slug URL.
//   2. Guard /cockpit/* behind a Supabase auth session.

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** For a legacy UUID-shaped /thing or /discover path, look up url_redirects and
 *  return a 301 to the slug. null when there's nothing to redirect (the common
 *  slug case never even hits the DB). Direct PostgREST fetch, no supabase-js. */
async function redirectLegacyPath(req: NextRequest): Promise<NextResponse | null> {
  const { pathname } = req.nextUrl;
  const seg = pathname.split("/")[2] ?? "";
  if (!UUID_RE.test(seg)) return null;

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!base || !key) return null;

  try {
    const url =
      `${base.replace(/\/+$/, "")}/rest/v1/url_redirects` +
      `?from_path=eq.${encodeURIComponent(pathname)}&select=to_path&limit=1`;
    const res = await fetch(url, { headers: { apikey: key, authorization: `Bearer ${key}` } });
    if (res.ok) {
      const rows = (await res.json()) as { to_path: string }[];
      const to = rows[0]?.to_path;
      if (to && to !== pathname) return NextResponse.redirect(new URL(to, req.url), 301);
    }
  } catch {
    // Never let a redirect-lookup failure break the page; fall through to render.
  }
  return null;
}

export async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname;

  // (1) Legacy UUID -> slug 301 for listing + guide paths.
  if (path.startsWith("/thing/") || path.startsWith("/discover/")) {
    return (await redirectLegacyPath(req)) ?? NextResponse.next();
  }

  // (2) Cockpit auth guard (also refreshes the session).
  if (path.startsWith("/cockpit")) {
    const res = NextResponse.next({ request: req });
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return req.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
          },
        },
      },
    );

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (path !== "/cockpit/login" && !user) {
      return NextResponse.redirect(new URL("/cockpit/login", req.url));
    }
    if (path === "/cockpit/login" && user) {
      return NextResponse.redirect(new URL("/cockpit", req.url));
    }
    return res;
  }

  return NextResponse.next();
}

export const config = { matcher: ["/cockpit/:path*", "/thing/:path*", "/discover/:path*"] };
