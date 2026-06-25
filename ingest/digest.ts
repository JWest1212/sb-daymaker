// ingest/digest.ts
//
// The nightly summary email (Doc 11 §8/§9). Composes from this run's source_runs +
// ingest_drops + image stats and emails the founder one link to the review queue.
// Reuses lib/email.ts (Resend). No-op (logs) if RESEND_API_KEY or DIGEST_TO is unset.

import type { SupabaseClient } from '@supabase/supabase-js';
import { sendEmail } from '../lib/email';
import type { ResolveStats } from './images';
import type { RunRow } from './land';

const REASON_LABEL: Record<string, string> = {
  no_start: 'no start-time', no_title: 'no title', no_address: 'no address',
  no_source: 'no source', duplicate: 'duplicate',
};

export interface DigestSummary {
  landed: number;
  gateDropped: number;
  dedupeDropped: number;
  images: ResolveStats | null;
  runs: RunRow[];
  closed: number;
}

export async function sendDigest(sb: SupabaseClient, s: DigestSummary): Promise<void> {
  const to = process.env.DIGEST_TO;
  if (!to) { console.log('  digest skipped — DIGEST_TO not set'); return; }

  const since = new Date(Date.now() - 2 * 3600_000).toISOString(); // this run's window

  const [{ count: queued }, dropsRes, runsRes] = await Promise.all([
    sb.from('things').select('*', { count: 'exact', head: true }).eq('status', 'needs_review'),
    sb.from('ingest_drops').select('reason').gte('created_at', since),
    sb.from('source_runs').select('source, landed, fetched, ok, error, started_at').gte('started_at', since),
  ]);

  const drops = dropsRes.data ?? [];
  const byReason: Record<string, number> = {};
  for (const d of drops) byReason[d.reason] = (byReason[d.reason] ?? 0) + 1;
  const breakdown = Object.entries(byReason).map(([r, n]) => `${n} ${REASON_LABEL[r] ?? r}`).join(', ');

  const runs = runsRes.data ?? [];
  const down = runs.filter((r) => !r.ok);
  const img = s.images;
  const overCap = img?.overCap ?? 0;

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
      ${overCap ? line('⚠ Over photo cap', `${overCap} cards → placeholder (resets next month)`) : ''}
      ${s.closed ? line('Closed & archived', String(s.closed)) : ''}
      ${down.length ? line('⚠ Sources down', down.map((d) => d.source).join(', ')) : ''}
    </table>
    <table style="border-collapse:collapse;font-size:13px;margin-bottom:22px">${sourceRows}</table>
    <a href="${site}/admin/review" style="display:inline-block;background:#16586A;color:#FCFAF5;text-decoration:none;font-weight:600;padding:11px 20px;border-radius:999px">Review the queue →</a>
  </div>`;

  const ok = await sendEmail({ to, subject, html });
  console.log(ok ? `  digest sent to ${to}` : '  digest skipped — Resend not configured / send failed');
}
