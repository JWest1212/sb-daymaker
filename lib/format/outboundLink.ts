// lib/format/outboundLink.ts  (Elevation v1 · Gate 1 · G1.4, adaptive outbound labels)
//
// The outbound label is a FUNCTION of type/price/destination, never a constant
// string. The old bug: "Get tickets" on a free library gathering, and no link at
// all on a ticketed museum. `buy_url` is the one generic outbound field (reused,
// not renamed), so the label is derived from it + the entry's type/price.
//
// Pure and deterministic. No em dash anywhere (Golden Rule); the "↗" glyph marks
// an outbound link, consistent with the rest of the app.

export interface OutboundInput {
  type?: string | null;
  free?: boolean | null;
  price_band?: string | null;
  buy_url?: string | null;
  starts_at?: string | null;
}

export interface OutboundLink {
  href: string;
  label: string;
}

// Ticketing handoffs (AXS/Ticketmaster and the common event-ticket hosts).
const TICKET_HOSTS =
  /\b(axs\.com|ticketmaster\.|livenation\.|eventbrite\.|seetickets\.|tix\.|etix\.|dice\.fm|showclix\.|frontgatetickets\.)/i;
// Reservation platforms (link only; SB Daymaker never books).
const RESERVE_HOSTS = /\b(opentable\.|resy\.com|sevenrooms\.|exploretock\.|tockhq\.|yelp\.com\/reservations)/i;

function isEvent(input: OutboundInput): boolean {
  return input.type === "event" || input.type === "happyhour" || !!input.starts_at;
}

function isFree(input: OutboundInput): boolean {
  return input.free === true || input.price_band === "free";
}

/** The correctly-labeled outbound link, or null when there's no URL (never a
 *  dead label). */
export function outboundLink(input: OutboundInput): OutboundLink | null {
  const href = input.buy_url?.trim();
  if (!href) return null;

  // Destination host wins first: a ticket host is always "Get tickets," a
  // reservation host is always "Reserve," regardless of type/price.
  if (TICKET_HOSTS.test(href)) return { href, label: "Get tickets ↗" };
  if (RESERVE_HOSTS.test(href)) return { href, label: "Reserve ↗" };

  // Then type/price: a free event's link is informational; a priced event's is a
  // ticket handoff; a place's link is its website.
  if (isEvent(input)) {
    return isFree(input)
      ? { href, label: "Event details ↗" }
      : { href, label: "Get tickets ↗" };
  }
  return { href, label: "Visit website ↗" };
}
