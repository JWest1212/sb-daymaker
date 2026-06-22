import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client built from the public env vars, or `null` if they
 * aren't configured yet (so pages can show a friendly "not connected" state
 * instead of crashing the build).
 *
 * Phase 1 uses ONLY the publishable/anon key — public reads, no auth. The
 * database is protected by Row-Level Security (see sbdaymaker_schema.sql), so
 * this key is safe in the browser. The secret key is server-only and is not
 * introduced until Phase 8.
 */
export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  return createClient(url, anonKey, {
    auth: { persistSession: false },
  });
}
