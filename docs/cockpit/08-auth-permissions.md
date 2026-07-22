# Section 9 - Auth and Permissions

## 9.1 How admin login/session works end to end

- Provider: Supabase Auth, email + password only. The sole login surface is SCR-12 (/cockpit/login): CMP-27 calls `supabase.auth.signInWithPassword({ email, password })` on a browser client from lib/supabaseBrowser.ts (`createBrowserClient(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)`).
- Session storage: auth state lives in cookies via @supabase/ssr. Server code reads it with lib/supabaseServer.ts getServerSupabase(), a `createServerClient` bound to Next's cookie store. The file's own comment: "Cookie-bound Supabase client for the admin auth session (cockpit login). Uses the publishable/anon key; auth state lives in cookies. Data operations use the service-role admin client, not this one."
- Identity check: lib/reviewServer.ts getAdminUser() (lines 29-33): `const sb = await getServerSupabase(); const { data: { user } } = await sb.auth.getUser(); return user;` - any signed-in Supabase user counts as the admin. There is no role table, no email allowlist, no claims check in code: possession of ANY account on this Supabase project's auth = full cockpit access. In practice exactly one founder account exists [INFERRED - account inventory is not visible in code].
- Data access: every read/write goes through lib/supabaseAdmin.ts getAdminSupabase(), the service-role client (SUPABASE_SECRET_KEY) that bypasses RLS. The cookie session is used ONLY as a gate; it never touches data.
- Token refresh: handled by @supabase/ssr's cookie flow. Note there is NO middleware.ts in the repo, and supabaseServer.ts's setAll catch comment says "cookie writes are handled by middleware on the response" - a middleware that does not exist. Consequence: expired access tokens are refreshed only where a route handler/server component happens to trigger it, and refreshed cookies may not persist from Server Components [INFERRED from the code comment plus the absence of middleware; observable behavior needs a live check - see 15-glossary-questions.md open questions].
- Sign-out: a signOut() server action exists in app/cockpit/actions.ts (legacy) but NO live screen renders any logout control. The operator effectively stays signed in until cookies expire or are cleared manually.
- Session timeout: no explicit configuration in the repo; Supabase project defaults apply [INFERRED].

## 9.2 The protection map

Mechanisms in play (exactly three, plus "none"):

- L = layout gate: app/admin/layout.tsx lines 12-13: `const user = await getAdminUser(); if (!user) redirect("/cockpit/login");` - protects PAGES under /admin only.
- R = per-route check: each API route calls getAdminUser() itself and returns 401 JSON when null (typical form, quoted from app/api/admin/weight/route.ts: `if (!(await getAdminUser())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });` - exact wording varies slightly per file; per-endpoint quotes in 07-api-backend.md).
- C = cron secret: `Authorization: Bearer ${CRON_SECRET}` header check, 401 otherwise.
- A = legacy server-action guard: app/cockpit/actions.ts requireUser() throws Error("unauthorized") when no cookie user.

| Route / endpoint group | Mechanism | Unauthenticated result |
|---|---|---|
| /admin/review, /admin/coverage, /admin/coverage/sources, /admin/coverage/neighborhood-sweep, /admin/coverage/recurring-rhythms, /admin/catalog, /admin/heroes, /admin/edition-draft, /admin/venues, /admin/images, /admin/flags (SCR-01..SCR-11) | L (layout gate; pages themselves contain no check) | redirect to /cockpit/login |
| /cockpit | none (pure redirect to /admin/review, which then gates) | bounced to login via the layout |
| /cockpit/login | none (public by design) | renders the form |
| /api/admin/** - all 55 routes (API-01..API-55) | R, individually per file (verified: getAdminUser appears in all 55 admin route files; per-route citation in 07-api-backend.md) | 401 `{ error: "unauthorized" }` (wording per route) |
| /api/review/** - all 5 routes (API-56..API-60) | R, same guard | 401 JSON |
| app/cockpit/actions.ts server actions (legacy) | A | thrown "unauthorized" error |
| /api/cron/heartbeat, /api/cron/reaper, /api/cron/send-edition | C (CRON_SECRET bearer) | 401 `{ ok: false, error: "unauthorized" }` |
| /api/cron/nightly | none - deliberately: it is a deprecated no-op that always returns `{ ok: false, deprecated: true, ... }` and touches nothing | the no-op JSON |

No scoped page or endpoint was found with missing enforcement. The structural caveat for a redesign: protection is 61 separate per-file checks plus one layout, not a middleware matcher. A NEW admin API route is unprotected unless its author remembers the check, and a page moved outside app/admin/ loses the gate. This is invariant 5 in index.md.

## 9.3 Roles / permission levels

Exactly one implicit role: "signed-in user = admin". No roles table, no permission levels, no per-screen authorization differences. All auth in this product is admin-only; end users have no accounts (the public site's save/plan state is anonymous localStorage/shared tokens, out of scope here).

## 9.4 Security-relevant behavior worth knowing

- The service-role key never reaches the client: data mutations happen in route handlers; the browser only holds the anon key + auth cookies.
- Login failures render Supabase's raw error string (CMP-27), which does not distinguish "no such user" from "wrong password" (Supabase returns a generic message) [INFERRED - message content is provider-side].
- All admin pages set `robots: { index: false, follow: false }` metadata; /cockpit/login does too.
- The keepalive approve/reject fetches (SCR-01) carry the auth cookies like any same-origin fetch; a session that expires mid-review makes those fire-and-forget posts fail SILENTLY (the UI already showed success) - the operator discovers it only when the card reappears next visit. Cross-referenced in 10-observability.md.
- There is no CSRF token layer; protection rests on same-origin cookie semantics and JSON content types [INFERRED risk assessment].
