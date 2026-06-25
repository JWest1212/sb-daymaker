// ingest/run.ts
//
// The nightly worker entrypoint (Doc 11 §10). Per-source isolation: one bad
// adapter can't sink the run (its source_runs row is marked ok=false and surfaces
// in the digest/source-health later). Flow for Phase 10:
//     fetch -> gate -> dedupe -> land   (no AI, no images yet)
//
// DRY_RUN=1 prints the per-source tallies and what it WOULD land, writing nothing.

import { registry } from './adapters/registry';
import { gate } from './gate';
import { dedupe, type DropRecord, type ExistingRow } from './dedupe';
import {
  startRun, finishRun, landCandidates, recordDrops, toThingRow, type RunRow,
} from './land';
import { getDb } from './db';
import type { Candidate, RawCandidate } from '../packages/shared/types';

const WINDOW_DAYS = 45;
const DRY = process.env.DRY_RUN === '1';

function window() {
  const from = new Date();
  const to = new Date(from.getTime() + WINDOW_DAYS * 86_400_000);
  return { fromISO: from.toISOString(), toISO: to.toISOString() };
}

function gateDrop(sourceKey: string, r: RawCandidate, reason: DropRecord['reason'], detail?: string): DropRecord {
  return {
    source: sourceKey,
    title: r.title,
    reason,
    detail,
    source_url: r.sourceUrl,
    raw: { ...r, raw: undefined }, // normalized candidate, minus the bulky original payload
  };
}

async function main() {
  const win = window();
  const sb = DRY ? null : getDb();

  type Tagged = { cand: Candidate; sourceKey: string };
  const gated: Tagged[] = [];
  const runs = new Map<string, RunRow>();
  let totalFetched = 0, totalGateDropped = 0;

  console.log(`\n[ingest] window ${win.fromISO.slice(0, 10)} .. ${win.toISO.slice(0, 10)}${DRY ? '  (DRY RUN — no writes)' : ''}\n`);

  // ---- FETCH + GATE, per source, isolated ----
  for (const adapter of registry) {
    const run: RunRow = sb ? await startRun(sb, adapter.key) : { id: 0, source: adapter.key, fetched: 0, qualified: 0, dropped: 0, landed: 0 };
    runs.set(adapter.key, run);
    try {
      const raw = await adapter.fetch(win);
      run.fetched = raw.length;
      const drops: DropRecord[] = [];
      for (const r of raw) {
        const g = gate(r);
        if (g.ok) { gated.push({ cand: g.candidate!, sourceKey: adapter.key }); run.qualified++; }
        else { drops.push(gateDrop(adapter.key, r, g.reason!, g.detail)); run.dropped++; }
      }
      if (sb && drops.length) await recordDrops(sb, run.id, drops);
      totalFetched += run.fetched;
      totalGateDropped += run.dropped;
      console.log(`  ${adapter.label.padEnd(20)} fetched ${run.fetched}  qualified ${run.qualified}  dropped ${run.dropped}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`  ${adapter.label.padEnd(20)} ERROR: ${msg}`);
      if (sb) await finishRun(sb, run, false, msg);
      runs.delete(adapter.key); // don't finish twice below
    }
  }

  // ---- DEDUPE (cross-source + against existing rows in the window) ----
  let existing: ExistingRow[] = [];
  if (sb) {
    const { data } = await sb
      .from('things')
      .select('id, title, starts_at, source')
      .not('starts_at', 'is', null)
      .gte('starts_at', win.fromISO)
      .lte('starts_at', win.toISO);
    existing = (data ?? []) as ExistingRow[];
  }
  const { keep, drops: dedupeDrops } = dedupe(gated.map((g) => g.cand), existing);

  // attribute dedupe drops + landed counts back to each source run
  for (const d of dedupeDrops) {
    const run = runs.get(d.source);
    if (run) run.dropped++;
  }
  const keptIds = new Set(keep.map((c) => c.id));
  for (const g of gated) if (keptIds.has(g.cand.id)) (runs.get(g.sourceKey)!).landed++;

  // ---- LAND ----
  let landed = 0;
  if (sb) {
    if (dedupeDrops.length) {
      // record each dedupe drop under its source's run (run_id may be null if its run errored)
      const byRun = new Map<number, DropRecord[]>();
      for (const d of dedupeDrops) {
        const id = runs.get(d.source)?.id ?? 0;
        (byRun.get(id) ?? byRun.set(id, []).get(id)!).push(d);
      }
      for (const [id, ds] of byRun) if (id) await recordDrops(sb, id, ds);
    }
    landed = await landCandidates(sb, keep);
    for (const run of runs.values()) await finishRun(sb, run, true);
  }

  // ---- SUMMARY ----
  console.log(
    `\n[ingest] ${totalFetched} fetched · ${keep.length} kept · ` +
      `${totalGateDropped} gate-dropped · ${dedupeDrops.length} dedupe-dropped` +
      (sb ? ` · ${landed} newly landed (needs_review)` : ''),
  );

  if (DRY) {
    console.log('\n[dry-run] would land:');
    for (const c of keep.slice(0, 200)) {
      const row = toThingRow(c) as { title: string; starts_at: string | null; source: unknown };
      console.log(`  • ${String(row.title).slice(0, 60).padEnd(60)} ${row.starts_at}  ${row.source}`);
    }
  }
}

main().catch((err) => {
  console.error('[ingest] fatal:', err);
  process.exit(1);
});
