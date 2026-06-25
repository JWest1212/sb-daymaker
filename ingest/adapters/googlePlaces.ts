// ingest/adapters/googlePlaces.ts
//
// Permanent-closure detection (Doc 11 §8/§13). Google Places (New) Place Details
// `businessStatus`; CLOSED_PERMANENTLY -> archive the place so it can never
// resurface ("We Want the Funk" must stay gone).
//
// Cost-bounded: gated behind CHECK_CLOSURES=1 (the weekly run sets it; the nightly
// run leaves it off), hard-capped per run, and counted against the same monthly
// image_spend cap as photo resolution. Off by default => nightly stays cheap.

import type { SupabaseClient } from '@supabase/supabase-js';

const GOOGLE_KEY = process.env.GOOGLE_PLACES_KEY;
const ENABLED = process.env.CHECK_CLOSURES === '1';
const MAX_PER_RUN = Number(process.env.CLOSURE_MAX_PER_RUN ?? 80);
const CAP = Number(process.env.IMAGE_MONTHLY_CALL_CAP ?? 1400);

async function businessStatus(placeId: string): Promise<string | null> {
  try {
    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`, {
      headers: { 'X-Goog-Api-Key': GOOGLE_KEY!, 'X-Goog-FieldMask': 'businessStatus' },
    });
    if (!res.ok) return null;
    const json: any = await res.json();
    return json?.businessStatus ?? null;
  } catch { return null; }
}

/** Returns the number of places archived as permanently closed. */
export async function detectClosures(sb: SupabaseClient): Promise<number> {
  if (!ENABLED || !GOOGLE_KEY) return 0;

  const month = new Date().toISOString().slice(0, 7);
  const { data: spendRow } = await sb.from('image_spend').select('google_calls').eq('month', month).maybeSingle();
  let calls = spendRow?.google_calls ?? 0;

  const { data: places } = await sb
    .from('things')
    .select('id, place_id, title')
    .in('status', ['needs_review', 'published'])
    .eq('type', 'place')
    .not('place_id', 'is', null)
    .order('last_confirmed', { ascending: true })
    .limit(MAX_PER_RUN);

  let archived = 0;
  for (const p of places ?? []) {
    if (calls >= CAP) break;
    calls++;
    const status = await businessStatus(p.place_id as string);
    if (status === 'CLOSED_PERMANENTLY') {
      await sb.from('things').update({ status: 'archived' }).eq('id', p.id);
      await sb.from('audit_log').insert({
        entity_type: 'thing', entity_id: p.id, action: 'reject', actor: 'system',
        payload: { reason: 'permanently_closed', title: p.title },
      });
      archived++;
    }
  }

  await sb.from('image_spend').upsert(
    { month, google_calls: calls, updated_at: new Date().toISOString() },
    { onConflict: 'month' },
  );
  return archived;
}
