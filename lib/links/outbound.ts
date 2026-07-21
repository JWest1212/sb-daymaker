// Elevation v1 · Gate 5 · G5.7, the single outbound-link seam.
//
// Every rendered outbound ticketing/reservation/website link routes through here,
// so affiliate parameters (AXS, Eventbrite, etc.) can be switched on later in ONE
// place without touching a dozen components, and without ever touching the ranker
// (the trust rule, CLAUDE.md §2.8: ranking never reads sponsor status). Nothing is
// monetized in this build; `withAffiliate` is deliberately an identity function.
// Pure, deterministic. No em dash (Golden Rule).

import {
  outboundLink,
  isTicketingUrl,
  type OutboundInput,
  type OutboundLink,
} from "@/lib/format/outboundLink";

export type { OutboundInput, OutboundLink };
export { isTicketingUrl };

/** Revenue is on hold this build. This flag + `withAffiliate` are the inert seam:
 *  flip the flag and fill in `withAffiliate` when affiliate deals are signed. */
export const AFFILIATE_ENABLED = false;

/**
 * The single place affiliate params would be appended to an outbound URL. Today
 * it returns the URL unchanged (revenue on hold). When enabled, add per-host
 * params here (e.g. an AXS/Eventbrite partner id) and nowhere else.
 */
export function withAffiliate(href: string): string {
  if (!AFFILIATE_ENABLED) return href;
  // Intentionally inert until monetization turns on. Keep the seam here.
  return href;
}

/**
 * Resolve the correctly-labeled outbound link for an entry, with the affiliate
 * seam applied to the href. Use this at every render site instead of calling
 * `outboundLink` directly, so the affiliate switch is a one-line change.
 */
export function resolveOutbound(input: OutboundInput): OutboundLink | null {
  const link = outboundLink(input);
  if (!link) return null;
  return { href: withAffiliate(link.href), label: link.label };
}
