import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Returns a Supabase client built from the public env vars, or `null` if they
 * aren't configured yet (so pages can show a friendly "not connected" state
 * instead of crashing the build).
 *
 * Phase 1 uses ONLY the publishable/anon key, public reads, no auth. The
 * database is protected by Row-Level Security (see sbdaymaker_schema.sql), so
 * this key is safe in the browser. The secret key is server-only and is not
 * introduced until Phase 8.
 */
let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  // Performance pass (2026-09-22). One client, reused. This used to build a new
  // client (and a new auth helper) on every call, several per page, which the
  // browser console flagged as "Multiple GoTrueClient instances". The client is
  // anonymous and stateless (no session is ever stored), so sharing it is safe.
  client ??= createClient(url, anonKey, {
    auth: { persistSession: false },
  });
  return client;
}
