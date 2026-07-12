"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Thing } from "@/lib/things";
import type { TimeOfDay, Weather } from "@/lib/weather";
import type { PoolPhoto } from "@/lib/venuePool";
import {
  cascade,
  filterByActivity,
  filterByLens,
  nearMeSort,
  pickAutoHero,
  pickEvergreenFallback,
  sbDay,
  withinHorizon,
  type Horizon,
} from "@/lib/explore";
import { OCCASION_BY_KEY, type OccasionKey } from "@/lib/occasions";
import { ZONE_LABEL, type Zone } from "@/lib/zones";
import { ACTIVITY_BY_KEY, type ActivityKey } from "@/lib/activities";
import type { Dimension } from "@/lib/tiles";
import { trackEvent } from "@/lib/analytics";
import { useTour } from "@/components/tour/useTour";
import { SBIcon } from "@/components/ui/SBIcon";
import { Hero } from "./Hero";
import { DiscoveryControls } from "./DiscoveryControls";
import { DiscoverySheet } from "./DiscoverySheet";
import type { ActiveChip } from "./DiscoveryChips";
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
  const { openTour } = useTour();
  const [vibe, setVibe] = useState<OccasionKey | null>(null);
  const [place, setPlace] = useState<Zone | null>(null);
  const [activity, setActivity] = useState<ActivityKey | null>(null);
  const [horizon, setHorizon] = useState<Horizon>("today");
  const [sheetOpen, setSheetOpen] = useState<Dimension | null>(null);
  // Home Rework spec §11.4 — the order dimensions were (most recently) set, so
  // "Show the closest matches" knows which filter to drop first.
  const [filterOrder, setFilterOrder] = useState<Dimension[]>([]);

  // Sets or clears one dimension's filter (key === null clears it) and keeps
  // filterOrder in sync. The single entry point for every way a filter can
  // change: doors/sheet taps, chip removal, and the header-search tag bridge.
  const applyFilter = (dimension: Dimension, key: string | null) => {
    if (dimension === "vibe") setVibe(key as OccasionKey | null);
    else if (dimension === "place") setPlace(key as Zone | null);
    else setActivity(key as ActivityKey | null);
    setFilterOrder((prev) => {
      const rest = prev.filter((d) => d !== dimension);
      return key ? [...rest, dimension] : rest;
    });
  };

  // Header search (spec §9.2 "Tags" group) sets a Vibe/Place filter from anywhere
  // in the app via a `?vibe=`/`?place=` query param, since the search panel lives
  // in the global header, outside this component's subtree. Applied once per
  // param, then cleared so re-searching the same tag still triggers a change.
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const vibeParam = searchParams.get("vibe");
    const placeParam = searchParams.get("place");
    if (!vibeParam && !placeParam) return;
    if (vibeParam && vibeParam in OCCASION_BY_KEY) applyFilter("vibe", vibeParam);
    if (placeParam && placeParam in ZONE_LABEL) applyFilter("place", placeParam);
    router.replace("/", { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const inHorizon = useMemo(
    () => things.filter((t) => withinHorizon(t, horizon, nowMs)),
    [things, horizon, nowMs],
  );

  // Home Rework spec §4 — stacked three-dimension filtering: Vibe -> Activity ->
  // cascade -> Place (nearMeSort stays outermost, preserving current behavior).
  const ordered = useMemo(() => {
    const lensed = filterByLens(inHorizon, vibe);
    const activityFiltered = filterByActivity(lensed, activity);
    return nearMeSort(cascade(activityFiltered), place);
  }, [inHorizon, vibe, activity, place]);

  const hasActiveFilters = vibe !== null || place !== null || activity !== null;

  // Home Rework spec §4/§12 — the sponsor-blind ranker: a valid founder pin for
  // today wins (only when it's actually in the current view), else pickAutoHero's
  // today-boosted-Tier-1-then-ordered[0] rule. Moved here from the old Hero.
  const rankedPick = useMemo(() => {
    if (ordered.length === 0) return null;
    if (pinnedHeroId) {
      const pinned = ordered.find((t) => t.id === pinnedHeroId);
      if (pinned) return pinned;
    }
    return pickAutoHero(ordered, sbDay(nowMs));
  }, [ordered, pinnedHeroId, nowMs]);

  // W1.3b (constraint C5, carried over from the old Hero): never blank when
  // there are NO active filters — Layer 1 is a deterministic evergreen from the
  // full pool, Layer 2 a hardcoded static card if even that pool is empty. When
  // filters ARE active and empty, that's §11.4's job (Show closest matches /
  // Clear filters) instead — an unrelated evergreen pick would only confuse a
  // deliberately-filtered empty result, so the fallback is skipped in that case.
  const fallbackPick = useMemo(() => {
    if (rankedPick || hasActiveFilters) return null;
    return pickEvergreenFallback(things, sbDay(nowMs));
  }, [rankedPick, hasActiveFilters, things, nowMs]);

  const pick = rankedPick ?? fallbackPick;
  const pickIsFallback = !rankedPick && pick != null;
  const pickIsStatic = !rankedPick && pick == null && !hasActiveFilters;

  // Feed excludes only the ranked pick (fallbacks aren't in `ordered`).
  const feed = useMemo(() => ordered.filter((t) => t.id !== rankedPick?.id), [ordered, rankedPick]);

  // Canonical door order (Place, Vibe, Activity), independent of filterOrder
  // (which tracks recency for the closest-matches recovery, not display order).
  const chips: ActiveChip[] = [
    ...(place ? [{ dimension: "place" as const, label: ZONE_LABEL[place] }] : []),
    ...(vibe ? [{ dimension: "vibe" as const, label: OCCASION_BY_KEY[vibe].label }] : []),
    ...(activity ? [{ dimension: "activity" as const, label: ACTIVITY_BY_KEY[activity].label }] : []),
  ];

  const clearAllFilters = () => {
    setVibe(null);
    setPlace(null);
    setActivity(null);
    setFilterOrder([]);
  };

  // Home Rework spec §11.4 (required) — drop the most-recently-added filter and
  // re-check; keep dropping until something shows or every filter is gone. Probes
  // with the pure filter functions directly rather than trusting `ordered` (which
  // only reflects the already-committed, currently-empty state).
  const handleShowClosestMatches = () => {
    let v = vibe;
    let p = place;
    let a = activity;
    const order = [...filterOrder];
    while (order.length > 0) {
      const dim = order.pop()!;
      if (dim === "vibe") v = null;
      else if (dim === "place") p = null;
      else a = null;
      const candidate = nearMeSort(cascade(filterByActivity(filterByLens(inHorizon, v), a)), p);
      if (candidate.length > 0) break;
    }
    setVibe(v);
    setPlace(p);
    setActivity(a);
    setFilterOrder(order);
  };

  const selectedForOpenSheet =
    sheetOpen === "place" ? place : sheetOpen === "vibe" ? vibe : sheetOpen === "activity" ? activity : null;

  // Home Rework spec §11.2 — the tapped tile shows its selected state before the
  // sheet closes, rather than the sheet vanishing instantly on tap.
  const handleTileSelect = (key: string) => {
    if (!sheetOpen) return;
    const dimension = sheetOpen;
    applyFilter(dimension, key);
    if (dimension === "vibe" && key) trackEvent("lens_select", { tag: key });
    setTimeout(() => setSheetOpen(null), 200);
  };

  return (
    <div className="sbd-explore">
      <Hero tod={tod} dateLabel={dateLabel} weather={weather} />

      <div className="sbd-explore__body">
        <DiscoveryControls
          onOpenSheet={setSheetOpen}
          chips={chips}
          onRemoveChip={(dimension) => applyFilter(dimension, null)}
          onResetChips={clearAllFilters}
          horizon={horizon}
          onHorizonChange={setHorizon}
        />
        <CascadeFeed
          items={feed}
          horizon={horizon}
          pick={pick}
          pickIsFallback={pickIsFallback}
          pickIsStatic={pickIsStatic}
          weather={weather}
          onClearFilters={clearAllFilters}
          hasActiveFilters={hasActiveFilters}
          onShowClosestMatches={handleShowClosestMatches}
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

      <DiscoverySheet
        dimension={sheetOpen}
        things={inHorizon}
        horizon={horizon}
        selected={selectedForOpenSheet}
        onSelect={handleTileSelect}
        onClose={() => setSheetOpen(null)}
      />
    </div>
  );
}
