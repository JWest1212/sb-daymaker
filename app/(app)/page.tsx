import type { Metadata } from "next";
import { getPublishedThings, stripForBrowse } from "@/lib/things";
import { getTimeOfDay, getDateLabel, getWeather } from "@/lib/weather";
import { getLiveHeroPinId } from "@/lib/heroServer";
import { getVenuePhotoPools } from "@/lib/venues";
import { ExploreClient } from "@/components/explore/ExploreClient";
import { parseHorizon, parseArea, parseOccasion, parseActivity } from "@/lib/exploreParams";

// Read fresh each request (DB-backed). All ranking/filtering is deterministic.
export const dynamic = "force-dynamic";

// Elevation v1 · Gate 2 · G2.3, the homepage gets its own hand-written title +
// description (not the sitewide default).
export const metadata: Metadata = {
  title: "SB Daymaker · What's Worth Doing in Santa Barbara Today",
  description:
    "What's worth doing in Santa Barbara today: events, live music, happy hours, and local favorites, refreshed daily. Find it, save it, share it.",
  alternates: { canonical: "/" },
};

/**
 * R1 W6.1. Filter and horizon state lives in the URL, and the SERVER reads it,
 * so the first paint already shows the right view.
 *
 * Before this the state was client-only: a shared link opened on Today with no
 * filters whatever the sender was looking at, and the back button could not
 * restore a view because there was nothing in the history to restore (EXP-019,
 * DET-015).
 */
export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const one = (k: string) => {
    const v = sp[k];
    return typeof v === "string" ? v : Array.isArray(v) ? v[0] : undefined;
  };
  const [things, weather, pinnedHeroId, venuePools] = await Promise.all([
    getPublishedThings(),
    getWeather(),
    getLiveHeroPinId(), // today's founder hero pin, if any (overrides the ranker)
    getVenuePhotoPools(), // Card Imagery Phase 2 §5.4, feeds CascadeFeed's per-feed dedupe
  ]);

  return (
    <ExploreClient
      /* R1 W6.9 (TP-B-05): fields no browse card reads are not serialized. */
      things={stripForBrowse(things)}
      tod={getTimeOfDay()}
      dateLabel={getDateLabel()}
      weather={weather}
      nowMs={Date.now()}
      pinnedHeroId={pinnedHeroId}
      venuePools={venuePools}
      initialHorizon={parseHorizon(one("when"))}
      initialArea={parseArea(one("area"))}
      initialOccasion={parseOccasion(one("occasion"))}
      initialActivity={parseActivity(one("activity"))}
    />
  );
}
