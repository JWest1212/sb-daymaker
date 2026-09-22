// lib/links/redirects.ts  (R1 W6.7 · DET-007, EDG-001)
//
// The MISS path for a thing or guide URL. Looked up only when the page did not
// resolve, so the common case (a live slug) never pays for it.
//
// This closes the gap the audit found: the proxy only redirects UUID-shaped
// segments, so an OLD SLUG, one that was shortened or superseded, had nothing
// to catch it and fell through to a not-found page. The url_redirects table
// already holds the mapping; it just had no reader on this path.

import { getSupabase } from "@/lib/supabase";

/** The destination for a path that no longer resolves, or null. Never throws:
 *  a lookup failure means the caller renders its not-found page, which is the
 *  same thing that would have happened anyway. */
export async function redirectTargetFor(path: string): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb
      .from("url_redirects")
      .select("to_path")
      .eq("from_path", path)
      .maybeSingle();
    if (error || !data) return null;
    const to = (data as { to_path: string }).to_path;
    return to && to !== path ? to : null;
  } catch {
    return null;
  }
}
