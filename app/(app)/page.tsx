import { getPublishedThings } from "@/lib/things";
import { pickPerfectDay } from "@/lib/explore";
import { getTimeOfDay, getDateLabel, getWeather } from "@/lib/weather";
import { ExploreClient } from "@/components/explore/ExploreClient";

// Read fresh each request (DB-backed). All ranking/filtering is deterministic.
export const dynamic = "force-dynamic";

export default async function ExplorePage() {
  const [things, weather] = await Promise.all([
    getPublishedThings(),
    getWeather(),
  ]);

  return (
    <ExploreClient
      things={things}
      tod={getTimeOfDay()}
      dateLabel={getDateLabel()}
      weather={weather}
      perfectDayIds={pickPerfectDay(things)}
      nowMs={Date.now()}
    />
  );
}
