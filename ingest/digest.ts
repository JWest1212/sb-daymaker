// ingest/digest.ts
//
// The nightly summary email (Doc 11 §8/§9). Composes from this run's source_runs +
// ingest_drops + image stats and emails the founder one link to the review queue.
// Reuses lib/email.ts (Resend). No-op (logs) if RESEND_API_KEY or DIGEST_TO is unset.

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '../lib/email';
import { sourceHealth, type SourceHealthRow } from '../lib/review';
import type { ResolveStats } from './images';
import type { RunRow } from './land';

const REASON_LABEL: Record<string, string> = {
  no_start: 'no start-time', no_title: 'no title', no_address: 'no address',
  no_source: 'no source', duplicate: 'duplicate',
};

export interface VenueFallbackEvent {
  venueName: string;
  /** What the dead Google photo was replaced with — 'wikimedia' if a strong
   *  candidate was found and auto-approved into the pool, 'none' if the venue's
   *  pool just lost a slot (falls through to gradient/motif once exhausted). */
  replacement: 'wikimedia' | 'none';
}

export interface DigestSummary {
  landed: number;
  gateDropped: number;
  dedupeDropped: number;
  images: ResolveStats | null;
  runs: RunRow[];
  closed: number;
  /** Card Imagery Build Spec Phase 2 §5.5 addendum, 2026-07-10 (Jim's ask) —
   *  confirmed-dead Google venue photos auto-replaced this run, so he can
   *  re-review the stand-in and go find a better photo himself if he wants one. */
  venueFallbacks?: VenueFallbackEvent[];
  /** Data Arch Redesign 23 Phase 4 §5.4 — sources auto-paused THIS run for
   *  hitting the consecutive-empty threshold. */
  autoPausedSources?: { key: string; label: string; consecutiveEmpty: number }[];
}

export async function sendDigest(sb: SupabaseClient, s: DigestSummary): Promise<void> {
  const to = process.env.DIGEST_TO;
  if (!to) { console.log('  digest skipped — DIGEST_TO not set'); return; }

  const since = new Date(Date.now() - 2 * 3600_000).toISOString(); // this run's window
  const recentCutoff = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10); // 14-day noise cap

  const [{ count: queued }, dropsRes, runsRes, failedEditionsRes, heldEditionsRes, sourcesRes] = await Promise.all([
    sb.from('things').select('*', { count: 'exact', head: true }).eq('status', 'needs_review'),
    sb.from('ingest_drops').select('reason').gte('created_at', since),
    sb.from('source_runs').select('source, landed, fetched, ok, error, started_at').gte('started_at', since),
    // Spec §10 "Assembly failure ... alert ops" — the drafter marks a status='failed'
    // row and never retries it; this is the only proactive alert for that (otherwise
    // it only shows up if someone happens to open the cockpit archive). Capped to the
    // last 14 days so a months-old failure doesn't nag forever. draft/approved both
    // still send automatically, so neither needs an alert.
    sb.from('editions').select('edition_date, edition_type, skip_reason').eq('status', 'failed').gte('edition_date', recentCutoff).order('edition_date'),
    // 'skipped' (Hold) is the one status that deliberately blocks the send — an
    // operator explicitly asked for that edition to NOT go out. Surface it every
    // night it's still on hold, since it's easy to forget one is sitting there.
    sb.from('editions').select('edition_date, edition_type, skip_reason').eq('status', 'skipped').order('edition_date'),
    // Data Arch Redesign 23 Phase 4 §5.2 — per-source-baseline silent-miss check,
    // distinct from `down` below (which is only about a run that errored).
    sb.from('sources').select('key, label, status, expected_yield, last_yield, last_ok_at, consecutive_empty').eq('status', 'active'),
  ]);

  const drops = dropsRes.data ?? [];
  const byReason: Record<string, number> = {};
  for (const d of drops) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  const breakdown = Object.entries(byReason).map(([r, n]) => `${n} ${REASON_LABEL[r] ?? r}`).join(', ');

  const runs = runsRes.data ?? [];
  const down = runs.filter((r) => !r.ok);
  const img = s.images;
  const overCap = img?.overCap ?? 0;
  const rejectedRelevance = img?.rejectedRelevance ?? 0;
  const failedEditions = failedEditionsRes.data ?? [];
  const heldEditions = heldEditionsRes.data ?? [];
  const belowBaseline = ((sourcesRes.data ?? []) as SourceHealthRow[])
    .filter((r) => sourceHealth(r) === 'below_baseline');
  const autoPausedSources = s.autoPausedSources ?? [];

  const site = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.sbdaymaker.com';
  const subject = `SB Daymaker — ${queued ?? 0} in review queue (${s.landed} new tonight)`;

  const line = (label: string, val: string) =>
    `<tr><td style="padding:4px 14px 4px 0;color:#4A4038">${label}</td><td style="font-family:monospace;color:#241C16">${val}</td></tr>`;

  const sourceRows = runs.map((r) =>
    `<tr><td style="padding:2px 14px 2px 0">${r.ok ? '🟢' : '🔴'} ${r.source}</td>` +
    `<td style="font-family:monospace;color:#4A4038">${r.ok ? `${r.landed} new / ${r.fetched} fetched` : (r.error ?? 'down')}</td></tr>`,
  ).join('');

  const html = `
  <div style="font-family:system-ui,sans-serif;max-width:560px;margin:0 auto;color:#241C16">
    <h1 style="font-family:Georgia,serif;font-size:22px;margin:0 0 4px">Tonight's ingest</h1>
    <p style="color:#4A4038;margin:0 0 16px">${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</p>
    <table style="border-collapse:collapse;font-size:14px;margin-bottom:18px">
      ${line('In review queue', String(queued ?? 0))}
      ${line('New tonight', String(s.landed))}
      ${line('Dropped', `${drops.length}${breakdown ? ` (${breakdown})` : ''}`)}
      ${img ? line('Images', `${img.free} free · ${img.google} Google · ${img.placeholder} placeholder`) : ''}
      ${rejectedRelevance ? line('Images flagged irrelevant', `${rejectedRelevance} → placeholder instead`) : ''}
      ${overCap ? line('⚠ Over photo cap', `${overCap} cards → placeholder (resets next month)`) : ''}
      ${s.closed ? line('Closed & archived', String(s.closed)) : ''}
      ${down.length ? line('⚠ Sources down', down.map((d) => d.source).join(', ')) : ''}
      ${belowBaseline.length ? line('🔻 Below own baseline',
        belowBaseline.map((r) => `${r.label} (${r.last_yield ?? 0}/${r.expected_yield} typical)`).join(', ')) : ''}
      ${autoPausedSources.length ? line('⏸ Auto-paused tonight',
        autoPausedSources.map((p) => `${p.label} (${p.consecutiveEmpty} empty runs in a row)`).join(', ')) : ''}
      ${failedEditions.length ? line('🔴 Edition assembly failed',
        failedEditions.map((e) => `${e.edition_date} (${e.edition_type}): ${e.skip_reason ?? 'unknown'}`).join('; ')) : ''}
      ${heldEditions.length ? line('⏸ Edition on hold',
        heldEditions.map((e) => `${e.edition_date} (${e.edition_type})`).join(', ') + ' — will NOT send; approving it sends immediately') : ''}
      ${s.venueFallbacks?.length ? line('📷 Venue photo(s) replaced',
        s.venueFallbacks.map((f) => `${f.venueName} → ${f.replacement === 'wikimedia' ? 'Wikimedia (auto-approved stand-in)' : 'motif (no strong Wikimedia candidate found)'}`).join('; ')) : ''}
    </table>
    <table style="border-collapse:collapse;font-size:13px;margin-bottom:22px">${sourceRows}</table>
    <a href="${site}/admin/review" style="display:inline-block;background:#16586A;color:#FCFAF5;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px">Review the queue →</a>
    ${(failedEditions.length || heldEditions.length) ? `<a href="${site}/admin/edition-draft" style="display:inline-block;margin-left:10px;background:#B0592A;color:#FCFAF5;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px">Review the edition →</a>` : ''}
    ${s.venueFallbacks?.length ? `<a href="${site}/admin/venues" style="display:inline-block;margin-left:10px;background:#7E8B6B;color:#FCFAF5;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px">Review venue photos →</a>` : ''}
    ${(belowBaseline.length || autoPausedSources.length) ? `<a href="${site}/admin/coverage" style="display:inline-block;margin-left:10px;background:#B23A2E;color:#FCFAF5;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px">Review source health →</a>` : ''}
  </div>`;

  const ok = await sendEmail({ to, subject, html });
  console.log(ok ? `  digest sent to ${to}` : '  digest skipped — Resend not configured / send failed');
}
