// ingest/heroEligibility.ts
//
// R1 Wave 2 (W2.4). Decide which rows are fit to be the day's pick.
//
// `hero_eligible` existed on every row and gated nothing: all 1,529 published
// rows had it set to true, including all 260 city-calendar rows and all 1,108
// past-dated ones (TP-A8-05). With nothing gating it and no eligibility check in
// the picker's fallback branch, the site's editorial recommendation for the day
// was "Single Family Design Board - Consent", a municipal design-review hearing
// with the blurb "Design board review meeting." (TP-A8-08).
//
// The pick is the single most prominent thing on the site. These rules are about
// what is fit to put there, not what is fit to list: a row can be perfectly good
// in the feed and still be a bad front-page recommendation.

import type { SupabaseClient } from '@supabase/supabase-js';

/** The placeholder address the geocoder writes when it knows only the city. It
 *  is not an address, and a pick the visitor cannot find is not a pick. */
export const PLACEHOLDER_ADDRESS = 'Santa Barbara, Santa Barbara, CA';
/** Shorter than this and the blurb is not telling anyone anything. */
export const MIN_BLURB_LENGTH = 40;

export type IneligibleReason =
  | 'civic'
  | 'no_address'
  | 'weak_blurb'
  | 'placeholder_photo';

export interface EligibilityRow {
  id: string;
  title: string;
  blurb: string | null;
  address: string | null;
  photo_source: string | null;
  happening_tier: number;
  is_civic: boolean;
  hero_eligible: boolean;
}

/** Every rule this row breaks. A row can break several; the report counts each. */
export function ineligibleReasons(r: EligibilityRow): IneligibleReason[] {
  const out: IneligibleReason[] = [];
  if (r.is_civic) out.push('civic');
  const address = r.address?.trim() ?? '';
  if (!address || address === PLACEHOLDER_ADDRESS) out.push('no_address');
  const blurb = r.blurb?.trim() ?? '';
  if (!blurb || blurb.length < MIN_BLURB_LENGTH || blurb.toLowerCase() === r.title.trim().toLowerCase()) {
    out.push('weak_blurb');
  }
  // A placeholder image on a dated event is a front-page card with nothing to
  // show. Evergreen places are judged less harshly: they have a motif fallback.
  if (r.photo_source === 'placeholder' && r.happening_tier === 1) out.push('placeholder_photo');
  return out;
}

export function isHeroEligible(r: EligibilityRow): boolean {
  return ineligibleReasons(r).length === 0;
}

export interface EligibilityReport {
  scanned: number;
  /** Currently eligible but breaking at least one rule: these lose eligibility. */
  toDisable: (EligibilityRow & { reasons: IneligibleReason[] })[];
  /** How many of toDisable break each rule. Rows can appear in several. */
  perRule: Record<IneligibleReason, number>;
  /** Rows that break exactly one rule, by rule, so the marginal cost of each is visible. */
  onlyRule: Record<IneligibleReason, number>;
  eligibleBefore: number;
  eligibleAfter: number;
  written: number;
  dryRun: boolean;
}

const PAGE = 1000;

async function fetchPublished(sb: SupabaseClient): Promise<EligibilityRow[]> {
  const rows: EligibilityRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb
      .from('things')
      .select('id, title, blurb, address, photo_source, happening_tier, is_civic, hero_eligible')
      .eq('status', 'published')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`hero eligibility read: ${error.message}`);
    const page = (data ?? []) as unknown as EligibilityRow[];
    rows.push(...page);
    if (page.length < PAGE) break;
  }
  return rows;
}

export async function applyHeroEligibility(
  sb: SupabaseClient,
  { dryRun = false }: { dryRun?: boolean } = {},
): Promise<EligibilityReport> {
  const rows = await fetchPublished(sb);
  const zero = (): Record<IneligibleReason, number> => ({
    civic: 0, no_address: 0, weak_blurb: 0, placeholder_photo: 0,
  });

  const toDisable: EligibilityReport['toDisable'] = [];
  const perRule = zero();
  const onlyRule = zero();
  let eligibleBefore = 0;

  for (const r of rows) {
    if (r.hero_eligible) eligibleBefore++;
    const reasons = ineligibleReasons(r);
    if (reasons.length > 0 && r.hero_eligible) {
      toDisable.push({ ...r, reasons });
      for (const x of reasons) perRule[x]++;
      if (reasons.length === 1) onlyRule[reasons[0]]++;
    }
  }

  const report: EligibilityReport = {
    scanned: rows.length,
    toDisable,
    perRule,
    onlyRule,
    eligibleBefore,
    eligibleAfter: eligibleBefore - toDisable.length,
    written: 0,
    dryRun,
  };
  if (dryRun || toDisable.length === 0) return report;

  let written = 0;
  for (let i = 0; i < toDisable.length; i += 200) {
    const chunk = toDisable.slice(i, i + 200).map((r) => r.id);
    const { data, error } = await sb
      .from('things')
      .update({ hero_eligible: false })
      .in('id', chunk)
      .select('id');
    if (error) throw new Error(`hero eligibility write: ${error.message}`);
    written += data?.length ?? 0;
  }
  report.written = written;

  await sb.from('audit_log').insert({
    entity_type: 'thing',
    entity_id: null,
    action: 'hero_eligibility',
    actor: 'pipeline',
    payload: { disabled: written, per_rule: report.perRule, eligible_after: report.eligibleAfter },
  });

  return report;
}

export function formatEligibilityReport(r: EligibilityReport, sampleSize = 20): string {
  const L: string[] = [];
  L.push(`${r.dryRun ? 'DRY RUN' : 'APPLIED'}  hero_eligibility`);
  L.push(`  published rows scanned          : ${r.scanned}`);
  L.push(`  hero_eligible before            : ${r.eligibleBefore}`);
  L.push(`  WOULD LOSE eligibility          : ${r.toDisable.length}`);
  L.push(`  hero_eligible after             : ${r.eligibleAfter}`);
  L.push('');
  L.push('  per rule (a row can break several):');
  for (const [k, n] of Object.entries(r.perRule)) L.push(`     ${k.padEnd(18)} ${String(n).padStart(4)}`);
  L.push('  rows that break ONLY that rule (its marginal cost):');
  for (const [k, n] of Object.entries(r.onlyRule)) L.push(`     ${k.padEnd(18)} ${String(n).padStart(4)}`);
  L.push('');
  L.push(`  ${Math.min(sampleSize, r.toDisable.length)} examples that would lose eligibility:`);
  for (const t of r.toDisable.slice(0, sampleSize)) {
    L.push(`     ${t.reasons.join('+').padEnd(34)} ${t.title}`);
    L.push(`        blurb: ${t.blurb ? `"${t.blurb.slice(0, 70)}"` : '(none)'}`);
    L.push(`        addr : ${t.address ?? '(none)'}`);
  }
  return L.join('\n');
}
