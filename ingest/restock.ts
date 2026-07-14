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

/** Run-now (C2b) finalize: a single dispatched directive. The full fresh pass
 *  already landed everything (main() ran the pipeline); here we just record how
 *  many of this run's candidates fill the gap and mark that one directive done.
 *  Never touches source. Returns the matching count. */
export async function finalizeRunNowDirective(sb: SupabaseClient, directiveId: string, pool: Candidate[]): Promise<number> {
  const { data: dir, error } = await sb
    .from('restock_directives')
    .select('id, scope_kind, scope_key, window_days, status')
    .eq('id', directiveId)
    .single();
  if (error || !dir) { console.log(`  restock run-now: directive ${directiveId} not found`); return 0; }
  const now = new Date().toISOString();
  const d = dir as Directive;
  const matches = pool.filter((c) => candidateMatchesScope(c, d.scope_kind, d.scope_key)).length;
  const run_note = `Run-now: refreshed all sources — ${matches} ${String(d.scope_key).replace(/_/g, ' ')} candidate(s) for the gap now in the queue.`;
  await sb.from('restock_directives')
    .update({ status: 'done', finished_at: now, results_count: matches, run_note })
    .eq('id', directiveId);
  await sb.from('audit_log').insert({
    entity_type: 'restock_directive', entity_id: directiveId, action: 'restock_ran_now', actor: 'system',
    payload: { results_count: matches, scope_kind: d.scope_kind, scope_key: d.scope_key },
  });
  return matches;
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
