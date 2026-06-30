// ingest/adapters/_shared/geoFilter.ts
//
// Single source of truth for "is this in scope?" — Santa Barbara, Goleta,
// Montecito, Carpinteria, Summerland, Isla Vista. Every aggregator/broad source
// must call isInScope() to drop online, virtual, or out-of-area events. (§2.1)

export const IN_SCOPE_CITIES = [
  'santa barbara', 'goleta', 'montecito', 'carpinteria', 'summerland', 'isla vista',
];

export const IN_SCOPE_ZIPS = [
  '93101', '93103', '93105', '93108', '93109', '93110', '93111', '93117',
  '93013', '93014', '93067',
];

// Rough bounding box (fallback when only lat/lng is known): Carpinteria ↔ Goleta coast.
const BBOX = { latMin: 34.36, latMax: 34.52, lngMin: -120.20, lngMax: -119.45 };

const DENY = [
  /\bonline\b/i, /\bvirtual\b/i, /\bwebinar\b/i, /\bzoom\b/i,
  /\bojai\b/i, /\bventura\b/i, /\bsanta ynez\b/i, /\bsolvang\b/i,
  /\blompoc\b/i, /\bbuellton\b/i, /\byucaipa\b/i, /\bsanta rosa\b/i,
];

export function isInScope(c: {
  venueName?: string;
  address?: string;
  lat?: number;
  lng?: number;
  title?: string;
}): boolean {
  const hay = `${c.venueName ?? ''} ${c.address ?? ''} ${c.title ?? ''}`.toLowerCase();
  if (DENY.some((rx) => rx.test(hay))) return false;
  if (IN_SCOPE_CITIES.some((city) => hay.includes(city))) return true;
  if (IN_SCOPE_ZIPS.some((z) => hay.includes(z))) return true;
  if (c.lat != null && c.lng != null) {
    return (
      c.lat >= BBOX.latMin && c.lat <= BBOX.latMax &&
      c.lng >= BBOX.lngMin && c.lng <= BBOX.lngMax
    );
  }
  return false; // unknown location — caller should log 'geo_unknown'
}
