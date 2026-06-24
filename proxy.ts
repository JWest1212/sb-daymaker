import { type NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Guard /cockpit/* behind a Supabase auth session (also refreshes the session).
export async function proxy(req: NextRequest) {
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
          cookiesToSet.forEach(({ name, value, options }) =>
            res.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = req.nextUrl.pathname;
  if (path.startsWith("/cockpit") && path !== "/cockpit/login" && !user) {
    return NextResponse.redirect(new URL("/cockpit/login", req.url));
  }
  if (path === "/cockpit/login" && user) {
    return NextResponse.redirect(new URL("/cockpit", req.url));
  }

  return res;
}

export const config = { matcher: ["/cockpit/:path*"] };
