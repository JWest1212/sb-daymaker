// ingest/blurbRules.ts
//
// R1 Wave 5 (W5.3). The rules a blurb has to pass before it lands.
//
// These are stated in the enrich prompt AND checked here, because a prompt is a
// request and a validator is a guarantee. A model that ignores an instruction
// should not be able to put the result on the front page; the row goes back for
// review with a reason instead.
//
// Pure and free. Nothing here calls a model.

/** Words that make a blurb sound like every other listing site. */
export const BANNED_PHRASES = [
  'nestled',
  'vibrant',
  'hidden gem',
  'something for everyone',
  "whether you're",
  'whether you are',
  'a feast for the senses',
  'fun for the whole family',
  'must-see',
  'must see',
  'iconic',
];

/** Shorter than this and the blurb is not saying anything. */
export const MIN_BLURB_LENGTH = 40;

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** The SB-local weekday name for an instant, lowercased. */
export function sbWeekdayName(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Los_Angeles',
    weekday: 'long',
  })
    .format(new Date(iso))
    .toLowerCase();
}

export type BlurbProblem =
  | 'missing'
  | 'too_short'
  | 'repeats_title'
  | 'banned_phrase'
  | 'wrong_weekday'
  | 'contains_address';

export interface BlurbCheckInput {
  blurb: string | null | undefined;
  title: string;
  starts_at?: string | null;
}

/** A street address inside a blurb: it belongs in the address field. */
const ADDRESS_RE = /\b\d{2,5}\s+[A-Z][A-Za-z.'-]*(?:\s+[A-Z][A-Za-z.'-]*){0,3}\s+(?:St|Street|Ave|Avenue|Blvd|Boulevard|Rd|Road|Dr|Drive|Ln|Lane|Way|Pl|Place)\b/;

/**
 * Every rule this blurb breaks. Empty means it is fit to publish.
 *
 * The weekday check is the one that catches a real, silent error: the audit
 * found blurbs naming Sunday for a Wednesday event and Thursday for a Tuesday
 * show. A wrong day is worse than no day, because the visitor acts on it.
 */
export function blurbProblems(input: BlurbCheckInput): BlurbProblem[] {
  const out: BlurbProblem[] = [];
  const blurb = input.blurb?.trim() ?? '';
  if (!blurb) return ['missing'];
  if (blurb.length < MIN_BLURB_LENGTH) out.push('too_short');
  // Punctuation-insensitive: the real shape is "Big Richard." under the title
  // "Big Richard", which a strict comparison would let through.
  const bare = (x: string) => x.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (bare(blurb) === bare(input.title)) out.push('repeats_title');

  const lower = blurb.toLowerCase();
  if (BANNED_PHRASES.some((p) => lower.includes(p))) out.push('banned_phrase');
  if (ADDRESS_RE.test(blurb)) out.push('contains_address');

  if (input.starts_at) {
    const named = WEEKDAYS.filter((d) => new RegExp(`\\b${d}\\b`).test(lower));
    if (named.length > 0 && !named.includes(sbWeekdayName(input.starts_at))) {
      out.push('wrong_weekday');
    }
  }
  return out;
}

/**
 * Problems that are unambiguous ERRORS, as opposed to signals that a blurb could
 * be better. Only these block a model's output at landing time.
 *
 * "Too short" is deliberately not one of them. "Golden-hour guitars by the
 * water." is 33 characters and is a better blurb than most long ones; rejecting
 * it would be the rule overriding the writing. Length is used instead to CHOOSE
 * which rows are worth re-enriching (W5.3), which is what the spec wants it for.
 */
export const DEFECTS: BlurbProblem[] = ['repeats_title', 'wrong_weekday', 'contains_address', 'banned_phrase'];

/** True when a blurb contains an actual error, not merely room for improvement. */
export function isBlurbDefective(input: BlurbCheckInput): boolean {
  return blurbProblems(input).some((p) => DEFECTS.includes(p));
}

/** True when a blurb is fit to publish and there is nothing more to ask of it. */
export function isBlurbPublishable(input: BlurbCheckInput): boolean {
  return blurbProblems(input).length === 0;
}

/** True when a row is worth sending back to the model: no blurb, a stub, or a
 *  blurb that just restates the title (W5.3's re-enrich selection). */
export function needsReEnrich(input: BlurbCheckInput): boolean {
  const p = blurbProblems(input);
  return p.includes('missing') || p.includes('too_short') || p.includes('repeats_title');
}

/** A one-line reason for the cockpit queue, or null when there is no problem. */
export function blurbRejectReason(input: BlurbCheckInput): string | null {
  const problems = blurbProblems(input);
  if (problems.length === 0) return null;
  const say: Record<BlurbProblem, string> = {
    missing: 'no blurb',
    too_short: `blurb under ${MIN_BLURB_LENGTH} characters`,
    repeats_title: 'blurb just repeats the title',
    banned_phrase: 'blurb uses a banned phrase',
    wrong_weekday: 'blurb names the wrong weekday',
    contains_address: 'blurb contains a street address',
  };
  return problems.map((p) => say[p]).join('; ');
}
