// ingest/restock.ts
//
// Queued-path restock consumption (Cockpit v2 §5.1, invariant-safe variant).
//
// The plan's original "stamp things.source='restock:{id}'" collides with a
// load-bearing rule: `source` is the provenance URL AND the uuid5 dedupe key
// (land.ts). So we never overwrite it. Instead, for each queued directive we
// record how many of tonight's candidates fill its gap, then mark it done.
// Tonight's normal run already lands everything, so nothing extra is landed here.
// The on-demand "fetch me more right now" path is Run now (C2b).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candidate } from '../packages/shared/types';
import { nearestZone, zoneForNeighborhood } from '../lib/zones';

export interface Directive {
  id: string;
  scope_kind: 'vibe' | 'zone';
  scope_key: string;
  window_days: number;
  status: string;
}

/** Does one of tonight's candidates fill a directive's gap? (Pure — unit-tested.) */
export function candidateMatchesScope(c: Candidate, kind: string, key: string): boolean {
  if (kind === 'vibe') return (c.proposed_tags ?? []).some((t) => t.tag === key);
  if (kind === 'zone') {
    const z = c.lat != null && c.lng != null
      ? nearestZone(c.lat, c.lng)
      : zoneForNeighborhood(c.neighborhood ?? null);
    return z === key;
  }
  return false;
}

/** Consume queued restock directives against tonight's candidate pool.
 *  Failure-isolated: a directive that errors is marked 'failed', never thrown.
 *  Returns the number of directives handled. */
export async function consumeDirectives(sb: SupabaseClient, pool: Candidate[]): Promise<number> {
  const { data, error } = await sb
    .from('restock_directives')
    .select('id, scope_kind, scope_key, window_days, status')
    .eq('status', 'queued');
  if (error) { console.log(`  restock: cannot read directives (${error.message})`); return 0; }
  const directives = (data ?? []) as Directive[];
  if (!directives.length) return 0;

  let handled = 0;
  for (const dir of directives) {
    const now = new Date().toISOString();
    try {
      await sb.from('restock_directives').update({ status: 'running', started_at: now }).eq('id', dir.id);
      const matches = pool.filter((c) => candidateMatchesScope(c, dir.scope_kind, dir.scope_key)).length;
      const run_note =
        `Tonight's run surfaced ${matches} ${dir.scope_key.replace(/_/g, ' ')} candidate(s). ` +
        `On-demand fetch-more arrives with Run now.`;
      await sb.from('restock_directives')
        .update({ status: 'done', finished_at: now, results_count: matches, run_note })
        .eq('id', dir.id);
      await sb.from('audit_log').insert({
        entity_type: 'restock_directive', entity_id: dir.id, action: 'restock_consumed', actor: 'system',
        payload: { results_count: matches, scope_kind: dir.scope_kind, scope_key: dir.scope_key },
      });
      handled++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sb.from('restock_directives')
        .update({ status: 'failed', finished_at: now, run_note: msg }).eq('id', dir.id)
        .then(() => {}, () => {});
      console.log(`  restock: directive ${dir.id} failed: ${msg}`);
    }
  }
  return handled;
}
