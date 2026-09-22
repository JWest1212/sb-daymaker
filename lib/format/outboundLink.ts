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

/** A URL points at a ticketing handoff (AXS/Ticketmaster/Eventbrite/etc). Shared
 *  so card CTAs and the detail action row agree on one definition, and so the
 *  affiliate seam (lib/links/outbound.ts) has one host list to key off. */
export function isTicketingUrl(url: string | null | undefined): boolean {
  return !!url && TICKET_HOSTS.test(url);
}

function isEvent(input: OutboundInput): boolean {
  return input.type === "event" || input.type === "happyhour" || !!input.starts_at;
}

function isFree(input: OutboundInput): boolean {
  return input.free === true || input.price_band === "free";
}

/** Named ticketing destinations, so the label can say where the link goes. */
const TICKET_BRAND: Array<[RegExp, string]> = [
  [/ticketmaster\./i, "Ticketmaster"],
  [/axs\.com/i, "AXS"],
  [/livenation\./i, "Live Nation"],
  [/eventbrite\./i, "Eventbrite"],
  [/dice\.fm/i, "DICE"],
  [/seetickets\./i, "See Tickets"],
  [/etix\./i, "Etix"],
  [/showclix\./i, "ShowClix"],
  [/frontgatetickets\./i, "Front Gate"],
  [/tix\./i, "Tix"],
];

/** A readable name for a host: the brand when we know it, else the bare domain
 *  with the www and the TLD-noise stripped ("sbbowl.com" -> "sbbowl.com"). */
export function hostLabel(url: string): string | null {
  for (const [re, name] of TICKET_BRAND) if (re.test(url)) return name;
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/**
 * The correctly-labelled outbound link, or null when there is no URL (never a
 * dead label).
 *
 * R1 W5.6 (DET-005): the label now names the DESTINATION. "Get tickets" told the
 * visitor what the button did but not where it would take them, and it appeared
 * on free events, where there is nothing to buy. The venue's own site says so,
 * and a free event says "Event details".
 */
export function outboundLink(input: OutboundInput): OutboundLink | null {
  const href = input.buy_url?.trim();
  if (!href) return null;

  // A free row never says "tickets": there is nothing to buy.
  if (isFree(input)) {
    const where = hostLabel(href);
    return { href, label: where ? `Event details at ${where} ↗` : "Event details ↗" };
  }

  // Destination host wins next: a ticket host is a ticket handoff whatever the
  // type says, and the label names which one.
  if (TICKET_HOSTS.test(href)) {
    const brand = hostLabel(href);
    return { href, label: brand ? `Tickets at ${brand} ↗` : "Get tickets ↗" };
  }
  if (RESERVE_HOSTS.test(href)) return { href, label: "Reserve ↗" };

  if (isEvent(input)) {
    const where = hostLabel(href);
    return { href, label: where ? `Tickets at ${where} ↗` : "Get tickets ↗" };
  }
  return { href, label: "Visit website ↗" };
}
