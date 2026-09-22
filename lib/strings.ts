// lib/strings.ts  (R1 W8.1 · XC-001, XC-006, MAP-002, EXP-035, EML-002)
//
// THE vocabulary. One exported string per concept, imported everywhere the
// concept appears, so the site cannot call one idea by three names again. The
// audit found "Place", "Where to?" and "Neighborhood" for one idea, "Vibe" and
// "Occasion" for another, "Clear filters", "Clear all" and "Reset" for a third.
//
// To rename a concept, change it here. Nothing else in the UI should spell one
// of these out by hand. (Admin and cockpit screens are internal and exempt.)

import { CADENCE_LINE } from "./edition/cadence";

// --- Explore doors ---------------------------------------------------------
/** The where-concept. The word "Place" is retired from the UI. */
export const AREA = "Area";
export const AREA_SHEET_TITLE = "Which part of town?";
/** The detail page's field label for the same concept. */
export const AREA_FIELD = "Area";
export const nearbyIn = (areaShort: string) => `Nearby in ${areaShort}`;

/** The reason-concept. The word "Vibe" is retired from the UI. */
export const OCCASION = "Occasion";
export const OCCASION_SHEET_TITLE = "What's the occasion?";

export const ACTIVITY = "Activity";
export const ACTIVITY_SHEET_TITLE = "What do you want to do?";

/** Clearing filters, everywhere: chips, the empty state, Plan. */
export const RESET = "Reset";

// --- Saved -----------------------------------------------------------------
export const SAVED = "Saved";
export const WANT_TO_GO = "Want to go";
export const BEEN = "Been";
export const onYourList = (n: number) => `${n} on your list`;
/** What the product actually keeps, said plainly (XC-004). */
export const STAYS_ON_PHONE = "Everything you save and mark stays on this phone.";

// --- The intro -------------------------------------------------------------
/** One name for the tour's control: footer, empty Saved, and the tour itself. */
export const HOW_IT_WORKS = "How it works";
export const FIND_THIS_AGAIN = `Find this again under ${HOW_IT_WORKS}.`;

// --- Adding ----------------------------------------------------------------
export const SUGGEST = "Suggest an event or business";

// --- Parts of the day ------------------------------------------------------
/** Morning, Afternoon, Evening everywhere. "Night" is retired. */
export const DAYPART = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" } as const;

// --- Newsletter ------------------------------------------------------------
/** The one cadence string (lives beside the email renderer, re-exported here). */
export { CADENCE_LINE };
export const NEWSLETTER_HEADING = "Santa Barbara, twice a week";
/** The newsletter's one name (EML-002: it was "weekend digest", "Weekend
 *  digest" and "SB Daymaker digest"). Sentence case in running text. */
export const NEWSLETTER = "Newsletter";
