// lib/cachedData.ts  (Performance pass, 2026-09-22)
//
// The public catalog, read once and shared, instead of rebuilt from the
// database on every page view and every search keystroke.
//
// Before this, Home, Weekend, Plan, the guide pages, the sample digest, the
// sitemap and /api/search each called getPublishedThings() uncached: several
// database round trips per request (measured 0.6 to 1.5 s on production).
// Now the result is kept for 5 minutes AND dropped the moment anything changes:
// revalidatePublic() (called by the nightly ingest's /api/revalidate hook and by
// every cockpit edit, approval and hero pin) expires the tag below. So content
// is exactly as fresh as before; only the repeated work is gone.
//
// Server-only (it imports next/cache). Client code never reads the pool.

import { unstable_cache } from "next/cache";
import { cache } from "react";
import { getPublishedThings, getThingBySlugOrId } from "./things";
import { getVenueNames, getVenuePhotoPools } from "./venues";
import { getGuideBySlugOrId } from "./guides";

/** One tag for everything public; revalidatePublic() expires it. */
export const PUBLIC_DATA_TAG = "sbd-public-data";
const WINDOW_SECONDS = 300; // the same 5-minute safety net the ISR pages use

const opts = { revalidate: WINDOW_SECONDS, tags: [PUBLIC_DATA_TAG] };

/** The browse pool (published, not civic, not finished), shared across requests. */
export const getPublishedThingsCached = unstable_cache(
  async () => getPublishedThings(),
  ["published-things-v1"],
  opts,
);

export const getVenuePhotoPoolsCached = unstable_cache(
  async () => getVenuePhotoPools(),
  ["venue-photo-pools-v1"],
  opts,
);

export const getVenueNamesCached = unstable_cache(
  async () => getVenueNames(),
  ["venue-names-v1"],
  opts,
);

/**
 * One lookup per request for a listing or a guide. generateMetadata and the
 * page itself both ask for the same row; Next does not dedupe supabase-js
 * calls on its own, so each detail view used to query the database twice.
 */
export const getThingBySlugOrIdOnce = cache(getThingBySlugOrId);
export const getGuideBySlugOrIdOnce = cache(getGuideBySlugOrId);
