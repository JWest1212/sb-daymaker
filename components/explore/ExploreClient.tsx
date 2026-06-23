"use client";

import { useMemo, useState } from "react";
import type { Thing } from "@/lib/things";
import type { TimeOfDay, Weather } from "@/lib/weather";
import {
  cascade,
  filterByLens,
  nearMeSort,
  withinHorizon,
  type Horizon,
} from "@/lib/explore";
import type { OccasionKey } from "@/lib/occasions";
import type { Zone } from "@/lib/zones";
import { useSaves } from "@/components/saves/SavesProvider";
import { Hero } from "./Hero";
import { ControlRow } from "./ControlRow";
import { LensSheet } from "./LensSheet";
import { NearMeSheet } from "./NearMeSheet";
import { CascadeFeed } from "./CascadeFeed";
import { OnePerfectDayCard } from "./OnePerfectDayCard";

export function ExploreClient({
  things,
  tod,
  dateLabel,
  weather,
  perfectDayIds,
  nowMs,
}: {
  things: Thing[];
  tod: TimeOfDay;
  dateLabel: string;
  weather: Weather | null;
  perfectDayIds: string[];
  nowMs: number;
}) {
  const { isSaved, toggle } = useSaves();
  const [lens, setLens] = useState<OccasionKey | null>(null);
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [zone, setZone] = useState<Zone | null>(null);
  const [lensOpen, setLensOpen] = useState(false);
  const [nearOpen, setNearOpen] = useState(false);

  const ordered = useMemo(() => {
    const inHorizon = things.filter((t) => withinHorizon(t, horizon, nowMs));
    const lensed = filterByLens(inHorizon, lens);
    return nearMeSort(cascade(lensed), zone);
  }, [things, horizon, lens, zone, nowMs]);

  const hero = ordered[0] ?? null;
  const feed = ordered.slice(1);

  return (
    <div className="sbd-explore">
      <Hero
        tod={tod}
        dateLabel={dateLabel}
        weather={weather}
        pick={hero}
        saved={hero ? isSaved(hero.id) : false}
        onToggleSave={() => hero && toggle(hero.id)}
      />

      <div className="sbd-explore__body">
        <ControlRow
          lens={lens}
          zone={zone}
          horizon={horizon}
          onOpenLens={() => setLensOpen(true)}
          onOpenNearMe={() => setNearOpen(true)}
          onHorizon={setHorizon}
        />
        <OnePerfectDayCard ids={perfectDayIds} />
        <CascadeFeed items={feed} />
      </div>

      <LensSheet
        open={lensOpen}
        current={lens}
        onClose={() => setLensOpen(false)}
        onSelect={(t) => {
          setLens(t);
          setLensOpen(false);
        }}
      />
      <NearMeSheet
        open={nearOpen}
        current={zone}
        onClose={() => setNearOpen(false)}
        onSelect={(z) => {
          setZone(z);
          setNearOpen(false);
        }}
      />
    </div>
  );
}
