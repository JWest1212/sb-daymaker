"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
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
import { TuneSheet } from "./TuneSheet";
import { CascadeFeed } from "./CascadeFeed";
import { EmailSignup } from "@/components/signup/EmailSignup";

export function ExploreClient({
  things,
  tod,
  dateLabel,
  weather,
  nowMs,
}: {
  things: Thing[];
  tod: TimeOfDay;
  dateLabel: string;
  weather: Weather | null;
  nowMs: number;
}) {
  const { isSaved, toggle } = useSaves();
  const [lens, setLens] = useState<OccasionKey | null>(null);
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [zone, setZone] = useState<Zone | null>(null);
  const [tuneOpen, setTuneOpen] = useState(false);

  const ordered = useMemo(() => {
    const inHorizon = things.filter((t) => withinHorizon(t, horizon, nowMs));
    const lensed = filterByLens(inHorizon, lens);
    return nearMeSort(cascade(lensed), zone);
  }, [things, horizon, lens, zone, nowMs]);

  const hero = ordered[0] ?? null;
  const feed = useMemo(() => ordered.slice(1), [ordered]);

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
          tuneOpen={tuneOpen}
          onOpenTune={() => setTuneOpen(true)}
          onHorizon={setHorizon}
        />
        <CascadeFeed
          items={feed}
          horizon={horizon}
          onClearFilters={() => { setLens(null); setZone(null); }}
        />

        <footer className="sbd-foot">
          <EmailSignup />
          <p className="sbd-foot__trust">
            No accounts, no login wall. Saves live on your device.
          </p>
          <Link href="/submit" className="sbd-foot__submit">
            ＋ Submit an event or business
          </Link>
        </footer>
      </div>

      <TuneSheet
        open={tuneOpen}
        currentLens={lens}
        currentZone={zone}
        onClose={() => setTuneOpen(false)}
        onLens={setLens}
        onZone={setZone}
      />
    </div>
  );
}
