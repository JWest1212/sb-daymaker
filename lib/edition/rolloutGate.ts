// lib/edition/rolloutGate.ts
//
// Spec §11.3 staged rollout, split out of send.ts (which is "server-only" and so
// can't be imported from vitest) so the gate logic itself stays testable.
//
// Ship draft-only for the first 1-2 real editions (operator approves manually)
// before relying on 07:00 auto-send. Unset/anything-but-"1" is the safe default: a
// still-draft edition is skipped, not sent. Set EDITION_AUTOSEND_UNAPPROVED=1 in
// Vercel's env once the drafter has earned trust, to restore full spec §7.2 behavior
// (approved OR still-draft both send).
export function autosendUnapprovedEnabled(): boolean {
  return process.env.EDITION_AUTOSEND_UNAPPROVED === "1";
}
