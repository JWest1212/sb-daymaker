// ingest/enrichDirectives.ts
//
// Queued-path re-enrich consumption (Cockpit Enhancements Phase 4, LC-10).
// A founder's "Redraft blurb + tags tonight" click only inserts a queued row —
// no live Claude call (batch-AI-only holds). Tonight's run picks up queued
// directives, re-drafts via the SAME enrich() Claude pass as regular ingest,
// and lands the fresh copy as a PENDING thing_edits overlay — never a silent
// live overwrite — so it goes through the Queue's normal glance-and-approve,
// same as any other edit.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Candidate } from '../packages/shared/types';
import { enrich } from './enrich';

interface Directive {
  id: string;
  thing_id: string;
  status: string;
}

/** Consume queued enrich_directives: re-draft each thing_id's blurb/tags and land
 *  the result as a pending thing_edits overlay. Failure-isolated per directive —
 *  one bad row is marked 'error', never thrown, never sinks the run. */
export async function consumeEnrichDirectives(sb: SupabaseClient): Promise<number> {
  const { data, error } = await sb
    .from('enrich_directives')
    .select('id, thing_id, status')
    .eq('status', 'queued');
  if (error) { console.log(`  enrich-directives: cannot read directives (${error.message})`); return 0; }
  const directives = (data ?? []) as Directive[];
  if (!directives.length) return 0;

  let handled = 0;
  for (const dir of directives) {
    const now = new Date().toISOString();
    try {
      // A thing can only carry one pending overlay at a time (thing_edits_one_pending)
      // — skip rather than error if the founder already has an edit in flight for it.
      const { data: existingOverlay } = await sb
        .from('thing_edits').select('id').eq('thing_id', dir.thing_id).eq('status', 'pending').maybeSingle();
      if (existingOverlay) {
        await sb.from('enrich_directives').update({ status: 'error', resolved_at: now }).eq('id', dir.id);
        console.log(`  enrich-directives: ${dir.thing_id} already has a pending edit — skipped`);
        continue;
      }

      const { data: t, error: tErr } = await sb
        .from('things')
        .select('id, type, title, happening_tier, happening_category, neighborhood, address, price_band, time_of_day_fit, is_21_plus, source, reason_to_go, local_note, last_confirmed')
        .eq('id', dir.thing_id).single();
      if (tErr || !t) throw new Error(tErr?.message ?? 'thing not found');

      const cand: Candidate = {
        id: t.id as string,
        type: t.type,
        status: 'needs_review',
        title: t.title as string,
        tier: Number(t.happening_tier) as Candidate['tier'],
        happening_category: t.happening_category,
        neighborhood: t.neighborhood ?? undefined,
        address: (t.address as string) ?? '',
        price_band: t.price_band ?? null,
        time_of_day_fit: (t.time_of_day_fit as Candidate['time_of_day_fit']) ?? [],
        starts_at: null, // enrich must never see/write a start time
        ends_at: null,
        source_url: (t.source as string) ?? '',
        reason_to_go: t.reason_to_go ?? undefined,
        local_note: t.local_note ?? undefined,
        is_21_plus: (t.is_21_plus as boolean) ?? undefined,
        last_confirmed: (t.last_confirmed as string)?.slice(0, 10) ?? '',
        start_strategy: 'none',
      };

      const [enriched] = await enrich([cand], { sb });
      const payload: Record<string, unknown> = {};
      if (enriched.blurb) payload.blurb = enriched.blurb;
      if (enriched.blurb_long) payload.blurb_long = enriched.blurb_long;
      const tags = (enriched.proposed_tags ?? []).map((x) => x.tag);
      if (tags.length) payload.tags = tags;

      if (!Object.keys(payload).length) {
        await sb.from('enrich_directives').update({ status: 'error', resolved_at: now }).eq('id', dir.id);
        console.log(`  enrich-directives: ${dir.thing_id} produced nothing new — marked error`);
        continue;
      }

      await sb.from('thing_edits').insert({ thing_id: dir.thing_id, payload, status: 'pending' });
      await sb.from('enrich_directives').update({ status: 'done', resolved_at: now }).eq('id', dir.id);
      await sb.from('audit_log').insert({
        entity_type: 'thing', entity_id: dir.thing_id, action: 'redraft_landed', actor: 'system',
        payload: { directive_id: dir.id, fields: Object.keys(payload) },
      });
      handled++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      await sb.from('enrich_directives')
        .update({ status: 'error', resolved_at: now }).eq('id', dir.id)
        .then(() => {}, () => {});
      console.log(`  enrich-directives: directive ${dir.id} failed: ${msg}`);
    }
  }
  return handled;
}
