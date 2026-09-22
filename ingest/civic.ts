// ingest/civic.ts
//
// R1 Wave 2 (W2.3). What counts as civic, and therefore never reaches a leisure
// feed. Decision D3 and D14: civic sources keep ingesting, because a civic
// surface may be worth building later, but they never publish to the public pool.
//
// The audit found the cost of not having this: the site's editorial
// recommendation for the day was "Single Family Design Board - Consent", a
// municipal design-review hearing, and four of the first seven feed items were
// city or library calendar entries (TP-A8-08, TP-A8-09).
//
// The lists below are DATA. Adding a term is a one-line edit here; the matcher
// underneath never changes. That is deliberate, so Jim can tune what gets caught
// without anyone touching matching logic.
//
// The cockpit still shows civic rows, so a genuine community event caught by a
// broad word can be flipped back by hand.

/**
 * Sources where EVERY row is civic, whatever the title says. Matched against the
 * row's source key or source URL.
 *
 * The city calendar is deliberately NOT in this list, and that is a considered
 * deviation from W2.3 as written. The spec says to flag every
 * `calendar.santabarbaraca.gov` row at the adapter. Checked against the real
 * data, that calendar is mixed: alongside Planning Commission and Single Family
 * Design Board it carries the city's own public programming. Blanket-flagging it
 * would have hidden Friday Night Swing at Carrillo Recreation Center, the Santa
 * Barbara Arts and Crafts Show on Cabrillo Boulevard, Chess Club, Scrabble Club,
 * Knitting and Crochet Club, Memory Cafe, Volunteer Gardening, Neighborhood
 * Cleanup and all of Creek Week: 23 of the 40 published rows from that source,
 * and roughly 5 percent of the entire live catalog.
 *
 * D3's subject is "civic MEETINGS", and the title rules below separate meetings
 * from programming cleanly: checked against all 40 published city-calendar rows,
 * every municipal meeting is caught and every real activity is kept. So the city
 * calendar is title-tested rather than blanket-flagged.
 *
 * Add a source here only when it carries nothing but meetings. Jim can override
 * this by moving 'calendar.santabarbaraca.gov' into the list.
 */
export const CIVIC_SOURCES: string[] = [];

/** Sources known to be civic-heavy. Kept as documentation of where the meetings
 *  come from (D14: these keep ingesting for a possible future civic surface);
 *  their rows are judged by title, not flagged wholesale. */
export const CIVIC_HEAVY_SOURCES: string[] = [
  'calendar.santabarbaraca.gov',
  'citysb',
];

/** Words that make a title civic on their own. Matched case-insensitively on a
 *  word boundary, so "boardwalk" is not "board" and "counciling" is not
 *  "council". */
export const CIVIC_TITLE_WORDS: string[] = [
  'agenda',
  'commission',
  'committee',
  'council',
  'hearing',
  'subcommittee',
  'task force',
  'work session',
];

/** Civic only in the specific shapes the audit actually saw, so a broad word
 *  cannot sweep up a real event on its own. */
export const CIVIC_PHRASES: RegExp[] = [
  // "board" is deliberately NOT a bare civic word. Board game nights, paddle
  // board yoga and charcuterie board workshops are real leisure listings, and
  // hiding them would repeat the over-correction this wave is meant to avoid.
  // It only counts as civic in an unmistakably municipal shape.
  /\bboard\s+of\b/i,
  // "advisory" is deliberately absent: a library's Teen Advisory Board is a
  // teen program, not municipal business. The genuine advisory bodies on the
  // city calendar all carry "committee" or "council" and are caught by those.
  /\b(?:design|review|planning|harbor|water|fire|police|school|zoning|appeals|architectural|housing|parks?)\s+board\b/i,
  /\bboard\s+(?:meeting|hearing|agenda|session)\b/i,
  // "consent" as an agenda word: "Single Family Design Board - Consent".
  /\bconsent\b(?!\s*(?:form|decree))/i,
  // A district forum: "City Council District 6 Forum".
  /\bdistrict\s*\d+\b[^.]*\bforum\b/i,
  /\bforum\b[^.]*\bdistrict\s*\d+\b/i,
  // Meeting-shaped titles.
  /\b(?:special|regular|emergency)\s+meeting\b/i,
  // "Arts Advisory Meeting": an advisory body's meeting, with no board/committee
  // /council word to catch it. The word "meeting" is what makes it civic here.
  /\badvisory\s+meeting\b/i,
  /\bpublic\s+(?:hearing|comment)\b/i,
];

/**
 * Holiday and closure notices (EXP-010). These are not events, they are the
 * absence of one: "Independence Day - Holiday Observed" tells a visitor nothing
 * to do. Same treatment as civic, for the same reason.
 */
export const CLOSURE_PHRASES: RegExp[] = [
  /\bholiday\s+observed\b/i,
  /\bobserved\s+holiday\b/i,
  /\b(?:office|offices|library|branch|pool|facility|facilities)\s+closed\b/i,
  /\bclosed\s+for\s+(?:the\s+)?holiday\b/i,
  /\bno\s+(?:service|collection|pickup)\b/i,
  /\bin\s+observance\s+of\b/i,
  // "Delayed Opening Hours": a change to opening times, not something to do.
  /\bdelayed\s+opening\b/i,
];

/** Escape a literal term for use inside a RegExp. */
function escape(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Built once from the word list above, not per call.
const TITLE_WORD_RE = new RegExp(`\\b(?:${CIVIC_TITLE_WORDS.map(escape).join('|')})\\b`, 'i');

export interface CivicInput {
  title?: string | null;
  /** The adapter key, e.g. "citysb". */
  source?: string | null;
  /** The row's source URL, e.g. "https://calendar.santabarbaraca.gov/event/...". */
  sourceUrl?: string | null;
}

/** True when the row comes from a source that is civic by definition. */
export function isCivicSource(input: CivicInput): boolean {
  const haystack = `${input.source ?? ''} ${input.sourceUrl ?? ''}`.toLowerCase();
  return CIVIC_SOURCES.some((s) => haystack.includes(s.toLowerCase()));
}

/** True when the title itself reads as a meeting, a hearing, or an agenda item. */
export function isCivicTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  if (TITLE_WORD_RE.test(title)) return true;
  return CIVIC_PHRASES.some((re) => re.test(title));
}

/** True when the title is a closure or holiday notice rather than an event. */
export function isClosureTitle(title: string | null | undefined): boolean {
  if (!title) return false;
  return CLOSURE_PHRASES.some((re) => re.test(title));
}

/**
 * The single question the pipeline asks: should this row be flagged `is_civic`?
 *
 * Flagged rows still land and still appear in the cockpit. They are excluded
 * from the public pool, search, the day's pick and Plan candidates.
 */
export function isCivic(input: CivicInput): boolean {
  return isCivicSource(input) || isCivicTitle(input.title) || isClosureTitle(input.title);
}

/** Which rule caught it, for the backfill report and the cockpit chip. */
export function civicReason(input: CivicInput): 'source' | 'title' | 'closure' | null {
  if (isCivicSource(input)) return 'source';
  if (isCivicTitle(input.title)) return 'title';
  if (isClosureTitle(input.title)) return 'closure';
  return null;
}
