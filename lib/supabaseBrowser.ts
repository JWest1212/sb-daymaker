import { createBrowserClient } from "@supabase/ssr";

/** Browser auth client for the cockpit login form (anon key + cookies). */
export function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
