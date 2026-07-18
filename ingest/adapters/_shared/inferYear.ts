// ingest/adapters/_shared/inferYear.ts
//
// Deterministic year inference for sources that print weekday + month + day with
// NO year (the LiveNotes pattern). The weekday acts as a checksum: we pick the
// year (within a forward window from runDate) for which that weekday matches.
// Ambiguous or non-matching → null (the gate drops it). (§2.3)

import { sbISO } from '../../tz';

/**
 * Resolve a year-less "Sat, May 23" style date to a full ISO instant.
 *
 * @param input.month     1-based month (1 = January)
 * @param input.day       day of month
 * @param input.weekday   expected day-of-week (0 = Sunday), used as checksum
 * @param input.timeHHmm  "20:30" wall-clock time in SB local, REQUIRED for gate
 * @param runDateISO      the ingest run date (determines forward window)
 * @returns ISO string with SB offset, or null if unresolvable / no time given
 */
export function resolveYearlessDate(
  input: { month: number; day: number; weekday?: number; timeHHmm?: string },
  runDateISO: string,
): string | null {
  const { month, day, weekday, timeHHmm } = input;
  if (!timeHHmm) return null; // gate requires clock time, never infer

  const [hh, mm] = timeHHmm.split(':').map(Number);
  if (!Number.isFinite(hh) || !Number.isFinite(mm)) return null;

  const runTs = Date.parse(runDateISO);
  if (Number.isNaN(runTs)) return null;
  const maxTs = runTs + 400 * 86_400_000;
  const runYear = new Date(runTs).getUTCFullYear();

  for (const y of [runYear, runYear + 1]) {
    const candidate = new Date(Date.UTC(y, month - 1, day));
    // Validate the date is real (e.g. Feb 30 normalizes to Mar 2)
    if (candidate.getUTCMonth() !== month - 1 || candidate.getUTCDate() !== day) continue;
    // Weekday checksum
    if (weekday !== undefined && candidate.getUTCDay() !== weekday) continue;
    const ts = candidate.getTime();
    if (ts < runTs - 86_400_000) continue; // skip if in the past (> 1 day ago)
    if (ts > maxTs) continue;              // skip if > 400 days out
    return sbISO(y, month, day, hh, mm);
  }
  return null;
}
