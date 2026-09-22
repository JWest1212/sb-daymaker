"use client";

import { useCallback, useMemo, useState } from "react";
import { exploreQuery, parseExploreState, PARAM, type ExploreState } from "@/lib/exploreParams";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Thing } from "@/lib/things";
import type { TimeOfDay, Weather } from "@/lib/weather";
import type { PoolPhoto } from "@/lib/venuePool";
import {
  cascade,
  filterByActivity,
  filterByLens,
  pickAutoHero,
  pickEvergreenFallback,
  sbDay,
  withinHorizon,
  type Horizon,
  filterByArea,
} from "@/lib/explore";
import { OCCASION_BY_KEY, type OccasionKey } from "@/lib/occasions";
import { AREA_BY_KEY, type AreaKey } from "@/lib/areas";
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

/** R1 W4.2 (EXP-015). What "Show the closest matches" says it relaxed, so the
 *  feed changing under the visitor is explained rather than just happening. */
const RELAXED_LABEL: Record<Dimension, string> = {
  place: "Showing all areas",
  vibe: "Showing all occasions",
  activity: "Showing all activities",
};

export function ExploreClient({
  things,
  tod,
  dateLabel,
  weather,
  nowMs,
  pinnedHeroId = null,
  venuePools = {},
  initialHorizon = "today",
  initialArea = null,
  initialOccasion = null,
  initialActivity = null,
}: {
  things: Thing[];
  tod: TimeOfDay;
  dateLabel: string;
  weather: Weather | null;
  nowMs: number;
  /** Founder's hero pin for today (server-resolved). Overrides the ranker when the
   *  pinned thing is present in the current view; otherwise the ranker picks. */
  pinnedHeroId?: string | null;
  /** Card Imagery Build Spec Phase 2 §5.4, approved venue photo pools, keyed by
   *  venue_id; threaded to CascadeFeed for the per-feed dedupe pass. */
  venuePools?: Record<string, PoolPhoto[]>;
  /** Gate 3 · G3.3, the horizon the view lands on. The /weekend route passes
   *  "weekend" so it's the crawlable web twin of the newsletter; Explore defaults
   *  to "today". */
  initialHorizon?: Horizon;
  /** R1 W6.1. Server-parsed URL state, so the first paint already matches the
   *  link that was opened. */
  initialArea?: AreaKey | null;
  initialOccasion?: OccasionKey | null;
  initialActivity?: ActivityKey | null;
}) {
  const { openTour } = useTour();
  const [sheetOpen, setSheetOpen] = useState<Dimension | null>(null);
  // Home Rework spec §11.4, the order dimensions were (most recently) set, so
  // "Show the closest matches" knows which filter to drop first.
  const [relaxedNote, setRelaxedNote] = useState<string | null>(null);
  const [filterOrder, setFilterOrder] = useState<Dimension[]>([]);

  // Sets or clears one dimension's filter (key === null clears it) and keeps
  // filterOrder in sync. The single entry point for every way a filter can
  // change: doors/sheet taps, chip removal, and the header-search tag bridge.
  // applyFilter is declared before writeUrl (it is used by the effects above),
  // so it reaches it through a ref rather than being reordered.
  const applyFilter = (dimension: Dimension, key: string | null) => {
    setFilterOrder((prev) => {
      const rest = prev.filter((d) => d !== dimension);
      return key ? [...rest, dimension] : rest;
    });
    writeUrl({
      [dimension === "vibe" ? "occasion" : dimension === "place" ? "area" : "activity"]:
        key as never,
    });
  };

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // R1 W6.1. The URL IS the state. Not mirrored into React state, derived from
  // it, so there is exactly one source of truth and nothing to keep in sync.
  //
  // This is what makes the rest work: a shared link opens the same view, the
  // back button restores the previous one (the browser keeps scroll per history
  // entry), and a filter sheet reading the "current" value cannot disagree with
  // the feed, because they read the same place (EXP-016, EXP-019, DET-015).
  //
  // The server passes the same values it parsed, so the first paint matches
  // before hydration.
  const urlState = useMemo(
    () => (searchParams ? parseExploreState((k) => searchParams.get(k)) : null),
    [searchParams],
  );
  const horizon: Horizon =
    urlState == null
      ? initialHorizon
      : pathname === "/weekend" && !searchParams?.get(PARAM.when)
        ? "weekend"
        : urlState.horizon;
  const place = urlState ? urlState.area : (initialArea ?? null);
  const vibe = urlState ? urlState.occasion : (initialOccasion ?? null);
  const activity = urlState ? urlState.activity : (initialActivity ?? null);

  const writeUrl = useCallback(
    (next: Partial<ExploreState>) => {
      const state: ExploreState = { horizon, area: place, occasion: vibe, activity, ...next };
      // /weekend is a real route with its own metadata; a visitor who landed
      // there stays on it until they choose a different horizon.
      const base = pathname === "/weekend" && state.horizon === "weekend" ? "/weekend" : "/";
      router.push(`${base}${exploreQuery(state)}`, { scroll: false });
    },
    [router, pathname, horizon, place, vibe, activity],
  );

  const inHorizon = useMemo(
    () => things.filter((t) => withinHorizon(t, horizon, nowMs)),
    [things, horizon, nowMs],
  );

  // Home Rework spec §4, stacked three-dimension filtering: Vibe -> Activity ->
  // cascade -> Place. R1 W4.6 (D11): there is no Near Me on Explore. The Place
  // door covers it, and Near Me stays a Saved-only sort.
  const ordered = useMemo(() => {
    const lensed = filterByLens(inHorizon, vibe);
    const activityFiltered = filterByActivity(lensed, activity);
    // R1 W4.2. Place is a real filter now. It used to be sortByDoorZone, which
    // bubbled matches to the top and kept everything else, while calling itself
    // "Filter by place" and producing a removable chip next to two dimensions
    // that really do filter (TP-A2-03, TP-A2-04).
    return cascade(filterByArea(activityFiltered, place));
  }, [inHorizon, vibe, activity, place]);

  const hasActiveFilters = vibe !== null || place !== null || activity !== null;

  // Home Rework spec §4/§12, the sponsor-blind ranker: a valid founder pin for
  // today wins (only when it's actually in the current view), else pickAutoHero's
  // today-boosted-Tier-1-then-ordered[0] rule. Moved here from the old Hero.
  // R1 W2.4 (EXP-017). The pick is computed from the HORIZON slice, before Place,
  // Occasion and Activity are applied, so narrowing the feed can never blank the
  // day's pick. Filtering is about what the visitor is browsing; the pick is the
  // day's recommendation and does not belong to a filter combination. When the
  // filtered feed comes back empty that is said in the feed area (§11.4), not by
  // deleting the pick.
  const pickPool = useMemo(() => cascade(inHorizon), [inHorizon]);
  const rankedPick = useMemo(() => {
    if (pickPool.length === 0) return null;
    if (pinnedHeroId) {
      // A founder pin still has to be in the horizon, but it is explicitly
      // permitted curation and is not eligibility-checked.
      const pinned = pickPool.find((t) => t.id === pinnedHeroId);
      if (pinned) return pinned;
    }
    return pickAutoHero(pickPool, sbDay(nowMs), nowMs);
  }, [pickPool, pinnedHeroId, nowMs]);

  // W1.3b (constraint C5, carried over from the old Hero): never blank when
  // there are NO active filters, Layer 1 is a deterministic evergreen from the
  // full pool, Layer 2 a hardcoded static card if even that pool is empty. When
  // filters ARE active and empty, that's §11.4's job (Show closest matches /
  // Clear filters) instead, an unrelated evergreen pick would only confuse a
  // deliberately-filtered empty result, so the fallback is skipped in that case.
  // R1 W2.4. The parachute now runs whether or not filters are active, because
  // the pick no longer depends on the filters: a filtered view that shows no
  // results still shows the day's pick above it.
  const fallbackPick = useMemo(() => {
    if (rankedPick) return null;
    return pickEvergreenFallback(things, sbDay(nowMs));
  }, [rankedPick, things, nowMs]);

  const pick = rankedPick ?? fallbackPick;
  const pickIsFallback = !rankedPick && pick != null;
  // R1 W2.4 (EXP-017). The static card is the last link in the chain and is shown
  // whenever nothing else resolved, filters or no filters, so the pick is never
  // blank under any filter combination.
  const pickIsStatic = !rankedPick && pick == null;

  // Feed excludes only the ranked pick (fallbacks aren't in `ordered`).
  const feed = useMemo(() => ordered.filter((t) => t.id !== rankedPick?.id), [ordered, rankedPick]);

  // Canonical door order (Place, Vibe, Activity), independent of filterOrder
  // (which tracks recency for the closest-matches recovery, not display order).
  const chips: ActiveChip[] = [
    ...(place ? [{ dimension: "place" as const, label: AREA_BY_KEY[place].label }] : []),
    ...(vibe ? [{ dimension: "vibe" as const, label: OCCASION_BY_KEY[vibe].label }] : []),
    ...(activity ? [{ dimension: "activity" as const, label: ACTIVITY_BY_KEY[activity].label }] : []),
  ];

  const clearAllFilters = () => {
    setRelaxedNote(null);
    setFilterOrder([]);
    writeUrl({ area: null, occasion: null, activity: null });
  };

  // Home Rework spec §11.4 (required), drop the most-recently-added filter and
  // re-check; keep dropping until something shows or every filter is gone. Probes
  // with the pure filter functions directly rather than trusting `ordered` (which
  // only reflects the already-committed, currently-empty state).
  const handleShowClosestMatches = () => {
    let v = vibe;
    let p = place;
    let a = activity;
    const order = [...filterOrder];
    // R1 W4.2 (EXP-015). Remember which dimensions were relaxed, so the result
    // can say what it did instead of the feed silently changing under the
    // visitor after they tapped a button.
    const relaxed: Dimension[] = [];
    while (order.length > 0) {
      const dim = order.pop()!;
      relaxed.push(dim);
      if (dim === "vibe") v = null;
      else if (dim === "place") p = null;
      else a = null;
      const candidate = cascade(filterByArea(filterByActivity(filterByLens(inHorizon, v), a), p));
      if (candidate.length > 0) break;
    }
    setFilterOrder(order);
    writeUrl({ occasion: v, area: p, activity: a });
    setRelaxedNote(
      relaxed.length > 0
        ? relaxed.map((d) => RELAXED_LABEL[d]).join(", ")
        : null,
    );
  };

  const selectedForOpenSheet =
    sheetOpen === "place" ? place : sheetOpen === "vibe" ? vibe : sheetOpen === "activity" ? activity : null;

  // Home Rework spec §11.2, the tapped tile shows its selected state before the
  // sheet closes, rather than the sheet vanishing instantly on tap.
  const handleTileSelect = (key: string) => {
    if (!sheetOpen) return;
    setRelaxedNote(null);
    const dimension = sheetOpen;
    applyFilter(dimension, key);
    // R1 W6.10. All three lenses, not just Occasion. The key and the dimension,
    // nothing else: no titles, no URLs, no free text.
    if (key) trackEvent("lens_select", { tag: key, dimension });
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
          nowMs={nowMs}
          onHorizonChange={(h) => writeUrl({ horizon: h })}
          resultCount={ordered.length}
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
          relaxedNote={relaxedNote}
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
