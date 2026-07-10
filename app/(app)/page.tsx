import { getPublishedThings } from "@/lib/things";
import { getTimeOfDay, getDateLabel, getWeather } from "@/lib/weather";
import { getLiveHeroPinId } from "@/lib/heroServer";
import { getVenuePhotoPools } from "@/lib/venues";
import { ExploreClient } from "@/components/explore/ExploreClient";

// Read fresh each request (DB-backed). All ranking/filtering is deterministic.
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [things, weather, pinnedHeroId, venuePools] = await Promise.all([
    getPublishedThings(),
    getWeather(),
    getLiveHeroPinId(), // today's founder hero pin, if any (overrides the ranker)
    getVenuePhotoPools(), // Card Imagery Phase 2 §5.4 — feeds CascadeFeed's per-feed dedupe
  ]);

  return (
    <ExploreClient
      things={things}
      tod={getTimeOfDay()}
      dateLabel={getDateLabel()}
      weather={weather}
      nowMs={Date.now()}
      pinnedHeroId={pinnedHeroId}
      venuePools={venuePools}
    />
  );
}
