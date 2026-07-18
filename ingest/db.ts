// ingest/db.ts
//
// Service-role Supabase client for the nightly worker. Bypasses RLS, SERVER/CI
// ONLY, never imported into client code. Mirrors lib/supabaseAdmin.ts but reads
// the GitHub-Action secret names first, falling back to the app's env names so
// the worker also runs locally with the existing .env.
//
// GitHub secrets (CI):   SUPABASE_URL, SUPABASE_SERVICE_ROLE
// Local fallback (.env):  NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SECRET_KEY

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export function getDb(): SupabaseClient {
  // Trim stray whitespace/newlines and any trailing slash a pasted secret may carry
  // (a trailing slash makes supabase-js build `…//rest/v1/…` -> "Invalid path").
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL)
    ?.trim().replace(/\/+$/, '');
  const key = (process.env.SUPABASE_SERVICE_ROLE ?? process.env.SUPABASE_SECRET_KEY)?.trim();
  if (!url || !key) {
    throw new Error(
      'Supabase credentials missing: set SUPABASE_URL + SUPABASE_SERVICE_ROLE (CI) ' +
        'or NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SECRET_KEY (local).',
    );
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
