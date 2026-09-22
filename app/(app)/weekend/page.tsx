import type { Metadata } from "next";
import { pageMeta } from "@/lib/seo/pageMeta";
import { getPublishedThings, stripForBrowse } from "@/lib/things";
import { getTimeOfDay, getDateLabel, getWeather } from "@/lib/weather";
import { getLiveHeroPinId } from "@/lib/heroServer";
import { getVenuePhotoPools } from "@/lib/venues";
import { ExploreClient } from "@/components/explore/ExploreClient";

// Elevation v1 · Gate 2 · G2.7 reserved the URL + metadata; Gate 3 · G3.3 makes it
// the real "This weekend" view: the same Explore surface, landed on the Weekend
// horizon. It's the crawlable web twin of the "weekend, in your inbox" newsletter
// and ranks for "things to do in santa barbara this weekend."

export const dynamic = "force-dynamic";

// R1 W7.8: through the shared helper, so og:site_name is set like every other page.
export const metadata: Metadata = pageMeta({
  title: "Things to Do in Santa Barbara This Weekend · SB Daymaker",
  description:
    "The weekend in Santa Barbara: events, live music, markets, and outings worth your time this weekend, refreshed daily.",
  path: "/weekend",
});

export default async function WeekendPage() {
  const [things, weather, pinnedHeroId, venuePools] = await Promise.all([
    getPublishedThings(),
    getWeather(),
    getLiveHeroPinId(),
    getVenuePhotoPools(),
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
      initialHorizon="weekend"
    />
  );
}
