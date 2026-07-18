import type { Metadata } from "next";
import { getPublishedThings } from "@/lib/things";
import { getTimeOfDay, getDateLabel, getWeather } from "@/lib/weather";
import { getLiveHeroPinId } from "@/lib/heroServer";
import { getVenuePhotoPools } from "@/lib/venues";
import { ExploreClient } from "@/components/explore/ExploreClient";

// Elevation v1 · Gate 2 · G2.7 reserved the URL + metadata; Gate 3 · G3.3 makes it
// the real "This weekend" view: the same Explore surface, landed on the Weekend
// horizon. It's the crawlable web twin of the "weekend, in your inbox" newsletter
// and ranks for "things to do in santa barbara this weekend."

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Things to Do in Santa Barbara This Weekend · SB Daymaker",
  description:
    "The weekend in Santa Barbara: events, live music, markets, and outings worth your time this weekend, refreshed daily by a local.",
  alternates: { canonical: "/weekend" },
  openGraph: {
    title: "Things to Do in Santa Barbara This Weekend",
    description: "Events, live music, markets, and outings worth your time this weekend in Santa Barbara.",
    url: "/weekend",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Things to Do in Santa Barbara This Weekend",
    description: "Events, live music, markets, and outings worth your time this weekend in Santa Barbara.",
  },
};

export default async function WeekendPage() {
  const [things, weather, pinnedHeroId, venuePools] = await Promise.all([
    getPublishedThings(),
    getWeather(),
    getLiveHeroPinId(),
    getVenuePhotoPools(),
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
      initialHorizon="weekend"
    />
  );
}
