// S3d, the Cockpit's shared display vocabulary. Labels only: payload values,
// API contracts, and DB values (happening_tier: 1|2|3, no_venue_ack, photo_ack,
// etc.) are untouched, this module only governs what the founder reads.

/** Per-row/per-card badges (SCR-06 catalog rows, SCR-09 venue badges, the
 *  Queue card, the Images desk), singular: "this thing is a(n) ___". */
export const TIER_WORD: Record<number, string> = { 1: "Event", 2: "Recurring", 3: "Place" };

/** Filter pills and summary prose ("34 ___ this week"), plural. */
export const TIER_WORD_PLURAL: Record<number, string> = { 1: "Events", 2: "Recurring", 3: "Places" };

// Dismissal vocabulary (approved r4): the word carries the consequence, so a
// founder never has to guess whether a dismiss is reversible.
/** Render-only: gone from this render, reappears next load/filter change. */
export const DISMISS_SKIP_FOR_NOW = "Skip for now";
/** Permanent: a specific proposed pairing should never be suggested again.
 *  Reserved for when a per-pairing persisted dismiss exists; nothing in this
 *  build writes one yet (every current "not a match" dismiss is render-only,
 *  i.e. Skip for now), so this constant currently has no call site. */
export const DISMISS_NEVER_MATCH = "Never match";
/** Permanent: this thing has no venue/photo and that's fine, stop flagging it
 *  (things.no_venue_ack, images photo_ack). Replaces "Leave on motif" /
 *  "Looks right as-is". */
export const DISMISS_KEEP_MOTIF_FOREVER = "Keep motif forever";
