import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role client (SUPABASE_SECRET_KEY), bypasses RLS. SERVER-SIDE ONLY.
 * Used by the nightly pipeline and the admin cockpit to read draft/needs_review
 * rows and write published status. Never import this into client code.
 * Returns null if the secret key isn't configured.
 */
export function getAdminSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
