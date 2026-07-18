// lib/format/daypart.ts  (Gate 0 · G0.2)
//
// The single source of truth for "what daypart is this event, really?", derived
// from its start instant in Santa Barbara local time (America/Los_Angeles),
// independent of the runtime timezone (the nightly worker runs on UTC CI). Used
// by both the daypart-conflict audit (ingest/audits/daypart_conflict_scan.ts)
// and the enrich generator guard (ingest/enrich.ts), so the scan and the
// generator can never disagree about what "evening" means.
//
// Boundaries (GATE_0 G0.2): morning <12, afternoon 12–16:59, evening 17–20:59,
// late ≥21.

export type Daypart = 'morning' | 'afternoon' | 'evening' | 'late';

const SB_HOUR = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Los_Angeles',
  hour: 'numeric',
  hour12: false,
});

/** The SB-local hour (0–23) of an instant, regardless of the machine's timezone. */
export function sbHour(iso: string): number {
  const parts = SB_HOUR.formatToParts(new Date(iso));
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  return h === 24 ? 0 : h; // en-US renders midnight as '24'
}

/** The true daypart bucket for an event's start instant. */
export function trueDaypart(iso: string): Daypart {
  const h = sbHour(iso);
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'late';
}

// Daypart words a blurb might use, each with the set of true dayparts it is
// CONSISTENT with. A word is a conflict when the event's true daypart is not in
// its set. Ordered specific→general so "late-night"/"nightcap" are consumed
// before the bare "night" rule can also match them.
const DAYPART_WORDS: { re: RegExp; label: string; consistent: Set<Daypart> }[] = [
  { re: /\bgolden hour\b/i, label: 'golden hour', consistent: new Set<Daypart>(['evening']) },
  { re: /\bsunset\b/i, label: 'sunset', consistent: new Set<Daypart>(['evening']) },
  { re: /\blate[- ]night\b/i, label: 'late-night', consistent: new Set<Daypart>(['late']) },
  { re: /\bnightcap\b/i, label: 'nightcap', consistent: new Set<Daypart>(['late']) },
  { re: /\bmorning\b/i, label: 'morning', consistent: new Set<Daypart>(['morning']) },
  { re: /\bafternoon\b/i, label: 'afternoon', consistent: new Set<Daypart>(['afternoon']) },
  { re: /\bevening\b/i, label: 'evening', consistent: new Set<Daypart>(['evening']) },
  // "night" as a time claim, but NOT topic phrases like "night sky/skies"
  // (astronomy), "night market", or "date night" (an occasion). The negative
  // lookahead skips those so an afternoon star party can still mention the night sky.
  { re: /\bnight\b(?!\s+(sky|skies|market))(?<!date\snight)/i, label: 'night', consistent: new Set<Daypart>(['evening', 'late']) },
];

/** Every daypart word in `text` whose implication contradicts the true daypart. */
export function daypartConflicts(text: string | null | undefined, iso: string): { word: string; trueDaypart: Daypart }[] {
  if (!text) return [];
  const td = trueDaypart(iso);
  let work = text;
  const conflicts: { word: string; trueDaypart: Daypart }[] = [];
  for (const w of DAYPART_WORDS) {
    if (w.re.test(work)) {
      work = work.replace(new RegExp(w.re.source, 'gi'), ' '); // consume so general rules don't re-match
      if (!w.consistent.has(td)) conflicts.push({ word: w.label, trueDaypart: td });
    }
  }
  return conflicts;
}

/** True if `text` uses any daypart word inconsistent with the event's true daypart. */
export function hasDaypartConflict(text: string | null | undefined, iso: string): boolean {
  return daypartConflicts(text, iso).length > 0;
}

const SENTENCE_SPLIT = /(?<=[.!?])\s+/;

/**
 * Last-resort generator guard (G0.2): drop any SENTENCE that uses a daypart word
 * contradicting the true daypart, rather than ship the conflict. Deterministic, * this is what guarantees a 10am event never renders "evening"/"night"/"late",
 * even if the model ignored the prompt and a corrective retry also failed.
 */
export function enforceDaypart(text: string | null | undefined, iso: string): string | null {
  if (!text) return text ?? null;
  const kept = text
    .split(SENTENCE_SPLIT)
    .filter((sentence) => daypartConflicts(sentence, iso).length === 0);
  return kept.join(' ').replace(/ {2,}/g, ' ').trim();
}
