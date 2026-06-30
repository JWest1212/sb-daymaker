// ingest/adapters/_shared/jsonLd.ts
//
// Extract schema.org Event (and subtypes) from <script type="application/ld+json">
// blocks embedded in server-rendered HTML. Primary time source for any venue page
// or aggregator that ships JSON-LD (Lobero, UCSB detail pages, Eventbrite, etc.).
// startDate/endDate are already ISO-8601 — use directly, no inference. (§2.2)

export interface LdEvent {
  name?: string;
  startDate?: string;
  endDate?: string;
  locationName?: string;
  address?: string;
  offersLow?: number | null;
  isFree?: boolean;
  url?: string;
}

const EVENT_TYPES = new Set([
  'Event', 'MusicEvent', 'TheaterEvent', 'SocialEvent', 'VisualArtsEvent',
  'SportsEvent', 'FoodEvent', 'Festival', 'ExhibitionEvent', 'ComedyEvent',
  'CourseInstance', 'LiteraryEvent', 'ScreeningEvent', 'BusinessEvent',
]);

function extractOffersLow(offers: unknown): number | null {
  if (!offers) return null;
  const list = Array.isArray(offers) ? offers : [offers];
  const prices = list
    .map((o: any) => {
      const p = parseFloat(o?.price ?? o?.lowPrice ?? '');
      return Number.isFinite(p) ? p : null;
    })
    .filter((p): p is number => p !== null);
  if (!prices.length) return null;
  return Math.min(...prices);
}

function isFreeOffer(offers: unknown): boolean | undefined {
  if (!offers) return undefined;
  const list = Array.isArray(offers) ? offers : [offers];
  const prices = list
    .map((o: any) => parseFloat(o?.price ?? ''))
    .filter(Number.isFinite);
  if (prices.length && prices.every((p) => p === 0)) return true;
  const availability = list.some((o: any) => /free/i.test(String(o?.price ?? '')));
  return availability || undefined;
}

function locationFrom(loc: any): { locationName?: string; address?: string } {
  if (!loc) return {};
  const name = typeof loc === 'string' ? loc : (loc?.name ?? undefined);
  const addr = loc?.address;
  let address: string | undefined;
  if (typeof addr === 'string') {
    address = addr;
  } else if (addr && typeof addr === 'object') {
    const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode]
      .filter(Boolean);
    address = parts.join(', ') || undefined;
  }
  return { locationName: name, address };
}

function normalizeEvent(obj: any): LdEvent | null {
  const type = obj?.['@type'];
  const types = Array.isArray(type) ? type : [type];
  if (!types.some((t) => EVENT_TYPES.has(t))) return null;

  const { locationName, address } = locationFrom(obj?.location);
  return {
    name: obj?.name ?? undefined,
    startDate: obj?.startDate ?? undefined,
    endDate: obj?.endDate ?? undefined,
    locationName,
    address,
    offersLow: extractOffersLow(obj?.offers),
    isFree: isFreeOffer(obj?.offers),
    url: obj?.url ?? undefined,
  };
}

/** Pull all schema.org Event objects from HTML. Returns events in document order. */
export function extractEvents(html: string): LdEvent[] {
  const results: LdEvent[] = [];
  // Regex over script tags — cheerio is overkill for JSON-LD and adds a dep import.
  const scriptRx = /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = scriptRx.exec(html)) !== null) {
    let parsed: unknown;
    try { parsed = JSON.parse(m[1]); } catch { continue; }
    const roots = Array.isArray(parsed) ? parsed : [parsed];
    for (const root of roots) {
      // Unwrap @graph
      const items = (root as any)?.['@graph']
        ? [(root as any)['@graph']].flat()
        : [root];
      for (const item of items) {
        const ev = normalizeEvent(item);
        if (ev) results.push(ev);
      }
    }
  }
  return results;
}
