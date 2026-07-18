// lib/flags.ts  (Elevation v1 · Gate 3 · G3.6, one-tap correction flags)
//
// Shared, client-safe vocabulary for the "Something off?" affordance. The reason
// set is CONTROLLED (a fixed enum of strings); the API rejects anything outside
// it. No contact/PII fields exist anywhere in this flow (§8 PII boundary).

export const FLAG_REASONS = [
  { key: "wrong_time", label: "Wrong time" },
  { key: "closed", label: "Closed now" },
  { key: "wrong_price", label: "Wrong price" },
  { key: "wrong_location", label: "Wrong location" },
  { key: "bad_photo", label: "Bad photo" },
  { key: "other", label: "Something else" },
] as const;

export type FlagReason = (typeof FLAG_REASONS)[number]["key"];

export const FLAG_REASON_KEYS: FlagReason[] = FLAG_REASONS.map((r) => r.key);

export function isFlagReason(v: unknown): v is FlagReason {
  return typeof v === "string" && (FLAG_REASON_KEYS as string[]).includes(v);
}

export const FLAG_REASON_LABEL: Record<FlagReason, string> = Object.fromEntries(
  FLAG_REASONS.map((r) => [r.key, r.label]),
) as Record<FlagReason, string>;

/** Detail free-text is optional and capped; never collect contact info. */
export const FLAG_DETAIL_MAX = 200;
