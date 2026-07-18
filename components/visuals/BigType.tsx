// components/visuals/BigType.tsx
//
// Card Imagery Build Spec Phase 3 §6.2, the D8 big-type fallback: "render one
// true fact (Fraunces, large) sourced from existing structured fields only (year,
// neighborhood, day); never AI at runtime." Frame/type treatment ported from the
// mockup's Lobero card ("1873 / lobero theatre, since.", `t-wine`); the fact
// itself is computed from whatever the thing actually has, never hardcoded like
// the mockup's one-off landmark year.
//
// Field priority: a dated thing's day-of-week is the strongest, always-true fact
// (SB local time, matches the rest of the app's date handling) and covers the vast
// majority of what reaches this fallback (Tier-1 events). Undated things (Tier-2/3
// misses) fall back to `nearby_zone` (already a short code, "funk", "mesa", a
// better fit for the big-type slot than the full `neighborhood` name, some of
// which run to 14 characters and would overflow). `SB` is the last-resort floor, // always renderable, never blank.

const SB_TZ = "America/Los_Angeles";

function dayAbbrev(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: SB_TZ, weekday: "short" })
    .format(new Date(iso))
    .toUpperCase();
}

function monthDay(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { timeZone: SB_TZ, month: "short", day: "numeric" })
    .format(new Date(iso))
    .toLowerCase();
}

function formatCategory(category: string): string {
  return category.replace(/_/g, " ");
}

interface BigTypeFacts {
  startsAt?: string | null;
  neighborhood?: string | null;
  nearbyZone?: string | null;
  category?: string | null;
}

export function bigTypeText({ startsAt, neighborhood, nearbyZone, category }: BigTypeFacts): {
  big: string;
  caption: string;
} {
  if (startsAt) {
    const caption = neighborhood ? neighborhood.replace(/_/g, " ") : monthDay(startsAt);
    return { big: dayAbbrev(startsAt), caption: `${caption}, ${monthDay(startsAt)}` };
  }
  if (nearbyZone) {
    return { big: nearbyZone.toUpperCase(), caption: category ? formatCategory(category) : "santa barbara" };
  }
  return { big: "SB", caption: category ? formatCategory(category) : "santa barbara" };
}

/** Fits the big word into the 100-unit viewBox without overflow/clipping, *  `nearby_zone` values ("waterfront") run longer than a 3-letter day abbreviation
 *  ("THU"), and the mockup's fixed 36 only ever had to fit "1873". */
function bigTypeFontSize(text: string): number {
  return Math.max(16, Math.min(36, 132 / Math.max(text.length, 1)));
}

export function BigTypeArt(facts: BigTypeFacts) {
  const { big, caption } = bigTypeText(facts);
  const fontSize = bigTypeFontSize(big);
  return (
    <svg viewBox="0 0 100 100" className="sbd-motif-art" aria-hidden="true">
      <text
        x={50}
        y={57}
        textAnchor="middle"
        fontWeight={900}
        fontSize={fontSize}
        letterSpacing="-.03em"
        fill="var(--ink)"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {big}
      </text>
      <path d="M20 65h60" stroke="var(--gold)" strokeWidth={1.7} />
      <text
        x={50}
        y={78}
        textAnchor="middle"
        fontSize={4.6}
        fill="var(--ink-2)"
        style={{ fontFamily: "var(--font-mono)" }}
      >
        {caption}
      </text>
      <rect width="100" height="100" fill="url(#sbd-vig)" />
      <rect width="100" height="100" filter="url(#sbd-grain)" opacity={0.12} style={{ mixBlendMode: "multiply" }} />
    </svg>
  );
}

export const BIGTYPE_TINT_CLASS = "sbd-tint-bigtype";
