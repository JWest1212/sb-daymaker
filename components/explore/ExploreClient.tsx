"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Thing } from "@/lib/things";
import type { TimeOfDay, Weather } from "@/lib/weather";
import type { PoolPhoto } from "@/lib/venuePool";
import {
  cascade,
  filterByLens,
  nearMeSort,
  pickAutoHero,
  pickEvergreenFallback,
  sbDay,
  withinHorizon,
  type Horizon,
} from "@/lib/explore";
import type { OccasionKey } from "@/lib/occasions";
import type { Zone } from "@/lib/zones";
import { useSaves } from "@/components/saves/SavesProvider";
import { trackEvent } from "@/lib/analytics";
import { useTour } from "@/components/tour/useTour";
import { SBIcon } from "@/components/ui/SBIcon";
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
  pinnedHeroId = null,
  venuePools = {},
}: {
  things: Thing[];
  tod: TimeOfDay;
  dateLabel: string;
  weather: Weather | null;
  nowMs: number;
  /** Founder's hero pin for today (server-resolved). Overrides the ranker when the
   *  pinned thing is present in the current view; otherwise the ranker picks. */
  pinnedHeroId?: string | null;
  /** Card Imagery Build Spec Phase 2 §5.4 — approved venue photo pools, keyed by
   *  venue_id; threaded to CascadeFeed for the per-feed dedupe pass. */
  venuePools?: Record<string, PoolPhoto[]>;
}) {
  const { isSaved, toggle } = useSaves();
  const { openTour } = useTour();
  const [lens, setLens] = useState<OccasionKey | null>(null);
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [zone, setZone] = useState<Zone | null>(null);
  const [tuneOpen, setTuneOpen] = useState(false);

  const ordered = useMemo(() => {
    const inHorizon = things.filter((t) => withinHorizon(t, horizon, nowMs));
    const lensed = filterByLens(inHorizon, lens);
    return nearMeSort(cascade(lensed), zone);
  }, [things, horizon, lens, zone, nowMs]);

  // A valid founder pin for today wins the hero slot — but only when it's actually
  // in the current view (survives the horizon/lens/zone filters); otherwise the
  // sponsor-blind ranker picks via the shared pickAutoHero helper (W2.1a): a founder-
  // boosted item happening today is preferred over the plain soonest card. The pin
  // reads no sponsor status.
  const rankedHero = useMemo(() => {
    if (pinnedHeroId) {
      const pinned = ordered.find((t) => t.id === pinnedHeroId);
      if (pinned) return pinned;
    }
    return pickAutoHero(ordered, sbDay(nowMs));
  }, [ordered, pinnedHeroId, nowMs]);

  // W1.3b (constraint C5): the hero is never blank. When nothing survives the
  // filters, Layer 1 shows a deterministic evergreen from the FULL pool; if the
  // pool has no evergreen at all, Layer 2 (a hardcoded static card in Hero) shows.
  const fallbackHero = useMemo(
    () => (rankedHero ? null : pickEvergreenFallback(things, sbDay(nowMs))),
    [rankedHero, things, nowMs],
  );
  const hero = rankedHero ?? fallbackHero;
  const isFallback = !rankedHero && hero != null; // Layer 1: real evergreen, show the note
  const showStatic = !rankedHero && hero == null; // Layer 2: static parachute card

  // Feed excludes only a ranked hero (fallbacks aren't in `ordered`); when a
  // fallback shows, `ordered` is empty and CascadeFeed's clear-filters state renders.
  const feed = useMemo(
    () => ordered.filter((t) => t.id !== rankedHero?.id),
    [ordered, rankedHero],
  );

  // Event 5: fire only when a lens (occasion tag) is actively selected, not when cleared.
  const handleLens = (tag: OccasionKey | null) => {
    setLens(tag);
    if (tag) trackEvent("lens_select", { tag });
  };

  return (
    <div className="sbd-explore">
      <Hero
        tod={tod}
        dateLabel={dateLabel}
        weather={weather}
        pick={hero}
        saved={hero ? isSaved(hero.id) : false}
        onToggleSave={() => hero && toggle(hero.id)}
        fallbackNote={isFallback}
        staticFallback={showStatic}
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
          venuePools={venuePools}
        />

        <footer className="sbd-foot">
          <EmailSignup />
          <p className="sbd-foot__trust">
            No accounts, no login wall. Saves live on your device.
          </p>
          <Link href="/submit" className="sbd-foot__submit">
            ＋ Submit an event or business
          </Link>
          <button
            type="button"
            className="sbd-tour-replay sbd-tour-replay--footer"
            aria-haspopup="dialog"
            onClick={openTour}
          >
            <SBIcon name="reset" size={14} />
            How SB Daymaker works
          </button>
        </footer>
      </div>

      <TuneSheet
        open={tuneOpen}
        currentLens={lens}
        currentZone={zone}
        onClose={() => setTuneOpen(false)}
        onLens={handleLens}
        onZone={setZone}
      />
    </div>
  );
}
