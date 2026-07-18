// lib/seo/jsonLd.ts  (Elevation v1 · Gate 2 · G2.5, structured data)
//
// Pure builders for the JSON-LD a detail page emits: Event (dated things),
// LocalBusiness/subtype (places), and BreadcrumbList (every page). Deterministic,
// no I/O, so structure is unit-testable. Absolute URLs + ISO 8601 dates only, per
// Google's Rich Results requirements. Undefined-valued keys are pruned so the
// emitted JSON never carries empty/nullish fields.

import { absoluteUrl } from "./site";

export interface JsonLdThing {
  id: string;
  slug: string | null;
  type: string;
  title: string;
  blurb: string | null;
  blurb_long: string | null;
  reason_to_go: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  neighborhood: string | null;
  happening_category: string | null;
  price_band: string | null;
  free: boolean | null;
  buy_url: string | null;
  starts_at: string | null;
  ends_at: string | null;
  photo_url: string | null;
  photo_source: string | null;
  hours: { dow: number; open: string; close: string }[] | null;
}

type Json = Record<string, unknown>;

/** Drop undefined/null/empty-array/empty-object values recursively so the emitted
 *  JSON-LD has no hollow fields (Google flags empties). */
export function prune<T>(value: T): T {
  if (Array.isArray(value)) {
    const arr = value.map(prune).filter((v) => v !== undefined);
    return (arr.length ? arr : undefined) as unknown as T;
  }
  if (value && typeof value === "object") {
    const out: Json = {};
    for (const [k, v] of Object.entries(value as Json)) {
      const pv = prune(v);
      if (pv !== undefined) out[k] = pv;
    }
    return (Object.keys(out).length ? out : undefined) as unknown as T;
  }
  if (value === null || value === "") return undefined as unknown as T;
  return value;
}

function description(t: JsonLdThing): string | undefined {
  return t.blurb ?? t.reason_to_go ?? t.blurb_long ?? undefined;
}

function firstSegment(address: string | null): string | undefined {
  return address ? address.split(",")[0].trim() || undefined : undefined;
}

/** schema.org PostalAddress from the single stored address string. */
function postalAddress(t: JsonLdThing): Json | undefined {
  if (!t.address) return undefined;
  return {
    "@type": "PostalAddress",
    streetAddress: firstSegment(t.address),
    addressLocality: "Santa Barbara",
    addressRegion: "CA",
    addressCountry: "US",
  };
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Event JSON-LD. Required: name, startDate, location. */
export function eventJsonLd(t: JsonLdThing, canonical: string): Json {
  const offers = t.buy_url
    ? {
        "@type": "Offer",
        url: t.buy_url,
        availability: "https://schema.org/InStock",
        ...(t.free ? { price: "0", priceCurrency: "USD" } : {}),
      }
    : t.free
      ? { "@type": "Offer", url: canonical, price: "0", priceCurrency: "USD", availability: "https://schema.org/InStock" }
      : undefined;

  return prune({
    "@context": "https://schema.org",
    "@type": "Event",
    name: t.title,
    startDate: t.starts_at ?? undefined,
    endDate: t.ends_at ?? undefined,
    eventStatus: "https://schema.org/EventScheduled",
    eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
    description: description(t),
    image: t.photo_url ? [t.photo_url] : undefined,
    url: canonical,
    location: {
      "@type": "Place",
      name: firstSegment(t.address) ?? t.neighborhood ?? t.title,
      address: postalAddress(t),
    },
    offers,
  });
}

const CATEGORY_TYPE: Record<string, string> = {
  food_drink_spot: "Restaurant",
  culture_spot: "TouristAttraction",
  scenic_chill: "TouristAttraction",
  shopping_browse: "Store",
  outdoor_activity: "TouristAttraction",
};

function priceRange(band: string | null, free: boolean | null): string | undefined {
  if (free) return "Free";
  return band && band !== "free" ? band : undefined;
}

/** LocalBusiness (or a more specific subtype) JSON-LD for a place. */
export function localBusinessJsonLd(t: JsonLdThing, canonical: string): Json {
  const type = (t.happening_category && CATEGORY_TYPE[t.happening_category]) || "LocalBusiness";
  const openingHours = (t.hours ?? [])
    .filter((h) => h.dow >= 0 && h.dow <= 6 && h.open && h.close)
    .map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DOW[h.dow]}`,
      opens: h.open,
      closes: h.close,
    }));

  return prune({
    "@context": "https://schema.org",
    "@type": type,
    name: t.title,
    description: description(t),
    image: t.photo_url ? [t.photo_url] : undefined,
    url: canonical,
    address: postalAddress(t),
    geo:
      t.lat != null && t.lng != null
        ? { "@type": "GeoCoordinates", latitude: t.lat, longitude: t.lng }
        : undefined,
    priceRange: priceRange(t.price_band, t.free),
    openingHoursSpecification: openingHours,
  });
}

/** BreadcrumbList. Items are [{name, path}] in order; paths become absolute. */
export function breadcrumbJsonLd(items: { name: string; path: string }[]): Json {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}

/** The full JSON-LD graph for a thing detail page: Event OR LocalBusiness, plus a
 *  Breadcrumb. `canonical` must be an absolute URL. */
export function thingJsonLd(t: JsonLdThing, canonical: string, canonicalPath: string): Json[] {
  const primary = t.type === "event" ? eventJsonLd(t, canonical) : localBusinessJsonLd(t, canonical);
  // Home IS Explore ("/") in this app, so the crumb is Home > Thing (no dup URL).
  const crumb = breadcrumbJsonLd([
    { name: "SB Daymaker", path: "/" },
    { name: t.title, path: canonicalPath },
  ]);
  return [primary, crumb];
}

/** Breadcrumb for a guide page: Home > Discover SB > Guide. */
export function guideBreadcrumbJsonLd(guideTitle: string, canonicalPath: string): Json {
  return breadcrumbJsonLd([
    { name: "SB Daymaker", path: "/" },
    { name: "Discover SB", path: "/discover" },
    { name: guideTitle, path: canonicalPath },
  ]);
}
