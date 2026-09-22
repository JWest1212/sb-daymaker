"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { getThingsByIds, type Thing } from "@/lib/things";
import { nearMeSort, areaMatchCount } from "@/lib/explore";
import { filterByState, splitPast, beenList, partitionSaves, pastEventLabel } from "@/lib/savedView";
import { groupSaved } from "@/lib/savedGroups";
import { AREA_BY_KEY, type AreaKey } from "@/lib/areas";
import { useSaves, type SaveState } from "@/components/saves/SavesProvider";
import { useTour } from "@/components/tour/useTour";
import { EmptyState, SBIcon } from "@/components/ui";
import { SavedToggle } from "./SavedToggle";
import { NearMeSheet } from "@/components/explore/NearMeSheet";
import { createSharedList } from "@/lib/shares";
import { trackEvent } from "@/lib/analytics";
import { SavedCard } from "./SavedCard";
import { MissingSavedCard } from "./MissingSavedCard";
import { ShareBar } from "./ShareBar";
import { RestorePanel } from "./RestorePanel";
import { MemoryRecap } from "./MemoryRecap";
import { useShareLink } from "./useShareLink";
import { readSaveTitles, rememberSaveTitles } from "@/lib/saveTitles";
import { HOW_IT_WORKS, STAYS_ON_PHONE, onYourList } from "@/lib/strings";

const WORDS = ["One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];
function spellCount(n: number): string {
  return n >= 1 && n <= 9 ? WORDS[n - 1] : String(n);
}

function readDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem("sbd_c2_dismissed");
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch { return new Set(); }
}

function persistDismissed(ids: Set<string>) {
  try { localStorage.setItem("sbd_c2_dismissed", JSON.stringify([...ids])); } catch {}
}

export function SavedClient() {
  const { ids, saves, state, setState, remove, counts, hydrated } = useSaves();
  const { openTour } = useTour();
  // R1 W1.5, the link is always shown when the native sheet does not take it.
  const { share: shareLink, sheet: shareSheet } = useShareLink();

  const [stateFilter, setStateFilter] = useState<SaveState>("want");
  const [zone, setZone] = useState<AreaKey | null>(null);
  const [nearOpen, setNearOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<string | null>(null);
  const [beenAck, setBeenAck] = useState<number | null>(null);
  const [dismissedPrompts, setDismissedPrompts] = useState<Set<string>>(readDismissed);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(id);
  }, [toast]);

  useEffect(() => {
    if (beenAck === null) return;
    const id = setTimeout(() => setBeenAck(null), 2500);
    return () => clearTimeout(id);
  }, [beenAck]);

  // R1 W1.1. /saved resolves each saved id directly and NEVER auto-deletes.
  //
  // What used to be here: an effect that diffed the saved ids against the
  // published browse pool and called remove(id) on anything missing. That pool
  // was silently truncated to 1,000 rows by the database, so a third of the
  // catalog looked "deleted" and was wiped off the visitor's device. Saving
  // anything from a Discover guide erased itself within seconds
  // (docs/audits/2026-09-21-technical-pass.md, TP-A1-01 and TP-A1-10).
  //
  // Saves live in localStorage, so the lookup has to happen after hydration and
  // on the client. `lookup` is append-only: an id that resolves once keeps its
  // row for the rest of the session, so a later network failure can never
  // downgrade a real card into "no longer listed", and a title stays available
  // for the missing-row card.
  const [lookup, setLookup] = useState<Map<string, Thing>>(() => new Map());
  // Ids a lookup has actually come back for. Kept as state, not a ref, because
  // the "no longer listed" list below is derived from it and has to re-render
  // when it changes. An id is only in here once the database has answered for
  // it, so a pending or failed fetch never reads as "gone".
  const [answered, setAnswered] = useState<Set<string>>(() => new Set());
  const inFlight = useRef<Set<string>>(new Set());
  // R1 W7.4. True once a lookup has failed to reach the database at all. The
  // ids stay pending (never "gone"); the page says it is offline and shows what
  // it can: the titles it remembered.
  // "offline": the browser says so. "down": online, but the database did not
  // answer. Different sentences, because only one of them is the visitor's.
  const [unreachable, setUnreachable] = useState<false | "offline" | "down">(false);
  const [titleCache] = useState<Record<string, string>>(readSaveTitles);
  // Bumped to ask again for whatever is still pending: when the connection
  // comes back, when the tab is shown again, and on a backoff timer while the
  // database is out of reach (a visitor who never went offline gets no
  // `online` event, so the timer is what brings a "down" list back).
  const [retryTick, setRetryTick] = useState(0);
  const retryDelay = useRef(10_000);
  useEffect(() => {
    const again = () => setRetryTick((t) => t + 1);
    const onVisible = () => { if (document.visibilityState === "visible") again(); };
    window.addEventListener("online", again);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.removeEventListener("online", again);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  useEffect(() => {
    if (unreachable !== "down") {
      retryDelay.current = 10_000;
      return;
    }
    const t = setTimeout(() => setRetryTick((n) => n + 1), retryDelay.current);
    retryDelay.current = Math.min(retryDelay.current * 2, 120_000);
    return () => clearTimeout(t);
    // retryTick: re-arm after each attempt that is still "down".
  }, [unreachable, retryTick]);
  // Orders the answers: a failure older than the latest success must not
  // flip the page back to "unreachable".
  const requestSeq = useRef(0);
  const lastOkSeq = useRef(0);

  useEffect(() => {
    if (!hydrated) return;
    const pending = ids.filter((id) => !answered.has(id) && !inFlight.current.has(id));
    if (pending.length === 0) return;
    const seq = ++requestSeq.current;
    for (const id of pending) inFlight.current.add(id);
    // R1 W7.4. When the browser already knows it is offline, do not sit out the
    // client's retries on a "Loading" line: go straight to the offline view.
    const request =
      typeof navigator !== "undefined" && navigator.onLine === false
        ? Promise.reject(new Error("offline"))
        : getThingsByIds(pending, { timeoutMs: 10_000 });
    // No "cancelled" guard on purpose (review fix). `lookup` and `answered` are
    // append-only and an answer is correct whenever it arrives, so a settled
    // answer is always applied. Throwing it away when a reconnect or a Remove
    // re-ran this effect mid-flight left the page stuck on "Loading": the
    // re-run found every id still in flight and asked for nothing.
    request
      .then((found) => {
        lastOkSeq.current = Math.max(lastOkSeq.current, seq);
        if (found.size > 0) {
          rememberSaveTitles([...found.values()].map((t) => ({ id: t.id, title: t.title })));
          setLookup((prev) => {
            const next = new Map(prev);
            for (const [id, thing] of found) next.set(id, thing);
            return next;
          });
        }
        setUnreachable(false);
        setAnswered((prev) => {
          const next = new Set(prev);
          for (const id of pending) next.add(id);
          return next;
        });
      })
      .catch(() => {
        // A transient failure must not read as "deleted". Leaving these ids out
        // of `answered` keeps them in the loading state and lets a later render
        // retry them. R1 W7.4: it does say so, and shows the remembered titles.
        if (seq < lastOkSeq.current) return; // a newer request already succeeded
        setUnreachable(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "down");
      })
      .finally(() => {
        for (const id of pending) inFlight.current.delete(id);
      });
    // retryTick: a reconnect, a return to the tab, or the backoff timer.
  }, [hydrated, ids, answered, retryTick]);

  const resolving = hydrated && ids.some((id) => !answered.has(id));
  // R1 W7.4 (TP-C3-03). Pending ids the database could not be asked about,
  // shown title-only from the cache while offline.
  const offlineIds = useMemo(
    () => (unreachable ? ids.filter((id) => !answered.has(id) && (saves[id] ?? "want") === stateFilter) : []),
    [unreachable, ids, answered, saves, stateFilter],
  );
  // The banner only while something is actually waiting on the database.
  const showUnreachable = unreachable && ids.some((id) => !answered.has(id));

  // Resolved rows and unresolvable ids, from the pure selector in lib/savedView.
  // Missing ids are shown, never deleted; the visitor decides whether to let one go.
  const { found: things, missing: allMissingIds } = useMemo(
    () => partitionSaves(ids, lookup, answered),
    [ids, lookup, answered],
  );
  // Keep the unresolvable ids on the same Want/Been tab the visitor filed them
  // under, so the section never contradicts the toggle's counts.
  const missingIds = useMemo(
    () => allMissingIds.filter((id) => (saves[id] ?? "want") === stateFilter),
    [allMissingIds, saves, stateFilter],
  );

  // Value-sensitive: keying on the `saves` map (not just its keys) means a
  // want→been flip re-derives immediately. See lib/savedView.ts.
  const viewItems = useMemo(
    () => nearMeSort(filterByState(things, saves, stateFilter), zone),
    [things, saves, stateFilter, zone],
  );

  // Stable mount-time snapshot, captured once so the past/current split is consistent.
  const [nowMs] = useState(() => Date.now());

  const doSplitPast = stateFilter === "want";
  const { current: mainItems, past: pastItems } = useMemo(
    () => (doSplitPast ? splitPast(viewItems, nowMs) : { current: viewItems, past: [] as Thing[] }),
    [viewItems, doSplitPast, nowMs],
  );
  // R1 W4.3: the chosen area becomes its own top group, so Near Me visibly does
  // something on a list that is otherwise grouped by type.
  const groups = useMemo(
    () => groupSaved(mainItems, zone ? { key: zone, label: AREA_BY_KEY[zone].label } : null),
    [mainItems, zone],
  );

  const beenItems = useMemo(() => beenList(things, saves), [things, saves]);

  // B3: count of want items whose starts_at falls in the upcoming Sat 00:00 → Sun 23:59.
  const weekendCount = useMemo(() => {
    if (stateFilter !== "want") return 0;
    const now = new Date(nowMs);
    const dow = now.getDay(); // 0=Sun, 6=Sat (local browser time, user is likely in SB/Pacific)
    const daysToSat = dow === 6 ? 0 : dow === 0 ? -1 : 6 - dow;
    const sat = new Date(now);
    sat.setDate(sat.getDate() + daysToSat);
    sat.setHours(0, 0, 0, 0);
    const sunEnd = new Date(sat);
    sunEnd.setDate(sunEnd.getDate() + 2);
    sunEnd.setHours(0, 0, 0, 0);
    const satMs = sat.getTime();
    const sunEndMs = sunEnd.getTime() - 1;
    return viewItems.filter((t) => {
      if (!t.starts_at) return false;
      const ts = new Date(t.starts_at).getTime();
      return ts >= satMs && ts <= sunEndMs;
    }).length;
  }, [viewItems, stateFilter, nowMs]);

  // C2: most recent past-dated want item not yet dismissed.
  const c2Item = useMemo(() => {
    if (stateFilter !== "want") return null;
    const pastWants = pastItems
      .filter((t) => !dismissedPrompts.has(t.id))
      .sort((a, b) => new Date(b.starts_at!).getTime() - new Date(a.starts_at!).getTime());
    return pastWants[0] ?? null;
  }, [pastItems, stateFilter, dismissedPrompts]);

  const dismissC2 = (id: string) => {
    setDismissedPrompts((prev) => {
      const next = new Set(prev);
      next.add(id);
      persistDismissed(next);
      return next;
    });
  };

  // C3: wrap setState to fire been acknowledgment on any flip to "been".
  const handleSetState = (id: string, newState: SaveState) => {
    const wasNotBeen = (state(id) ?? "want") !== "been";
    setState(id, newState);
    if (newState === "been" && wasNotBeen) {
      setBeenAck(counts.been + 1);
    }
  };

  const toggleSelect = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const makeLinkAndShare = async (shareIds: string[], kind: "list" | "single") => {
    if (shareIds.length === 0) return;
    const token = await createSharedList(shareIds);
    if (!token) {
      setToast("Couldn't create a link. Try again.");
      return;
    }
    // Event 3: a shared list link was created (token never sent to analytics).
    trackEvent("share_create", { kind, count: shareIds.length });
    const url = `${window.location.origin}/s/${token}`;
    // Anything other than a completed native share opens the link sheet, which
    // the hook renders. No toast is needed for those, the sheet IS the feedback.
    const result = await shareLink(url, "My Santa Barbara picks");
    if (result === "shared") setToast("Shared!");
  };

  const shareSelected = async () => {
    await makeLinkAndShare([...selected], "list");
    setSelectMode(false);
    setSelected(new Set());
  };

  // B3: assemble status line text from live counts.
  const listCount = viewItems.length;
  const statusLine = useMemo(() => {
    if (listCount === 0) return null;
    const n = spellCount(listCount);
    if (stateFilter === "been") {
      return {
        main: `${n} ${listCount === 1 ? "place" : "places"} you’ve made it to`,
        sub: "Your Santa Barbara so far",
      };
    }
    const sub =
      weekendCount > 0
        ? `${spellCount(weekendCount)} happening this weekend · stays on this phone, no account`
        : "Stays on this phone, no account";
    return { main: onYourList(listCount), sub }; // R1 W8.1, one summary string
  }, [listCount, stateFilter, weekendCount]);

  // --- Empty state (0 total saves) ---
  // R1 W7.1 (SAV-005). Not a dead end: the icon-set heart instead of an
  // off-palette emoji, and two ways forward into the site.
  if (counts.total === 0) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <h1 className="sbd-saved__h1 sbd-visually-hidden">Saved</h1>
        <EmptyState
          icon={<SBIcon name="heart" size={28} strokeWidth={1.75} />}
          title="Nothing saved yet"
          message="Tap the heart on anything you love and it'll live right here, on this device, no account needed."
          action={
            <div className="sbd-empty__actions">
              <div className="sbd-empty__ways">
                <Link href="/" className="sbd-empty__way">Browse today</Link>
                <Link href="/discover" className="sbd-empty__way">Read a guide</Link>
              </div>
              <button
                type="button"
                className="sbd-howitworks sbd-howitworks--saved"
                aria-haspopup="dialog"
                onClick={openTour}
              >
                New here? {HOW_IT_WORKS}
              </button>
            </div>
          }
        />
      </div>
    );
  }

  return (
    <div className="sbd-saved">
      {/* R1 W7.8 (A11Y-002). The page's title in the heading outline. It had
          no h1 at all; a screen reader arrived on a page whose headings began
          at h3. */}
      <h1 className="sbd-saved__h1">Saved</h1>
      {/* T2: Want / Been toggle + A1 Near Me (only at ≥4 in-view) */}
      <div className="sbd-saved__controls">
        <SavedToggle
          value={stateFilter}
          wantCount={counts.want}
          beenCount={counts.been}
          onChange={(v) => setStateFilter(v)}
        />
        {/* R1 W7.1 (SHR-003, TP-A5-02). The one line that reconciles the tab
            badge (Want to go only) with what is inside. */}
        <p className="sbd-saved__tally" aria-live="polite">
          {counts.want} to go, {counts.been} been
        </p>
        {listCount >= 4 ? (
          <div className="sbd-saved__tools">
            <button
              type="button"
              className={`sbd-ctrl__near${zone ? " is-active" : ""}`}
              onClick={() => setNearOpen(true)}
            >
              <SBIcon name="pin" size={14} />
              <span>
                {zone
                  ? `${AREA_BY_KEY[zone].short}, ${areaMatchCount(viewItems, zone)} of ${viewItems.length}`
                  : "Near Me"}
              </span>
            </button>
          </div>
        ) : null}
      </div>

      {/* B3: Editorial status line */}
      {statusLine && !selectMode ? (
        <div className="sbd-saved__status" aria-live="polite">
          <p className="sbd-saved__status-main">{statusLine.main}</p>
          <p className="sbd-saved__status-sub">{statusLine.sub}</p>
        </div>
      ) : null}

      {selectMode ? (
        <p className="sbd-saved__hint">Tap to choose what to send, one or many.</p>
      ) : null}

      {/* C2: Proactive "Did you make it?" prompt */}
      {c2Item && !selectMode ? (
        <div className="sbd-c2">
          {/* R1 W7.1 (SAV-003). Named from the event's own time: an 11 AM event
              read at 2 PM is "This morning", not "Last night". */}
          <p className="sbd-c2__eyebrow">{pastEventLabel(new Date(c2Item.starts_at!).getTime(), nowMs)}</p>
          <div className="sbd-c2__content">
            {c2Item.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sbd-c2__thumb" src={c2Item.photo_url} alt="" loading="lazy" />
            ) : null}
            <p className="sbd-c2__question">Did you make it to {c2Item.title}?</p>
          </div>
          <p className="sbd-c2__sub">
            {"Mark what you did. It stays on this phone, with the rest of your list."}
          </p>
          <div className="sbd-c2__actions">
            <button
              type="button"
              className="sbd-c2__yes"
              onClick={() => {
                handleSetState(c2Item.id, "been");
                dismissC2(c2Item.id);
              }}
            >
              <SBIcon name="check" size={14} /> Yes, I went
            </button>
            <button
              type="button"
              className="sbd-c2__no"
              onClick={() => dismissC2(c2Item.id)}
            >
              Not this time
            </button>
          </div>
        </div>
      ) : null}

      {stateFilter === "been" && !selectMode ? (
        <MemoryRecap beenCount={counts.been} beenItems={beenItems} />
      ) : null}

      {/* R1 W7.4 (TP-C3-03). Offline, the list still renders: the rows the
          page has, and a title for every save it remembers. */}
      {showUnreachable ? (
        <p className="sbd-saved__offline" role="status">
          {unreachable === "offline"
            ? "You’re offline, showing your saved list."
            : "We couldn’t reach SB Daymaker just now, showing your saved list."}
        </p>
      ) : null}
      {offlineIds.length > 0 ? (
        <section className="sbd-saved__group">
          <div className="sbd-saved__list">
            {offlineIds.map((id) => (
              <MissingSavedCard
                key={id}
                title={titleCache[id] ?? null}
                offline={unreachable || "offline"}
                onRemove={() => remove(id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {viewItems.length === 0 ? (
        resolving && things.length === 0 ? (
          showUnreachable ? null : <p className="sbd-saved__resolving" aria-live="polite">Loading your list...</p>
        ) : stateFilter === "been" ? null : missingIds.length > 0 ? null : (
          <EmptyState
            icon={<SBIcon name="heart" size={28} strokeWidth={1.75} />}
            message="Nothing in your want-to-go list right now."
          />
        )
      ) : (
        groups.map((g) => (
          <section key={g.key} className="sbd-saved__group">
            <div className="sbd-group-hdr">
              <span className="sbd-group-dot" style={{ background: g.dot }} />
              {g.label}
              <span className="sbd-group-hdr__chip">{g.items.length}</span>
              <span className="sbd-group-hdr__rule" role="presentation" />
            </div>
            <div className="sbd-saved__list">
              {g.items.map((t, i) => (
                <SavedCard
                  key={t.id}
                  thing={t}
                  index={i}
                  state={(state(t.id) ?? "want") as SaveState}
                  selectMode={selectMode}
                  selected={selected.has(t.id)}
                  onToggleSelect={() => toggleSelect(t.id)}
                  onSetState={(s) => handleSetState(t.id, s)}
                  onRemove={() => remove(t.id)}
                  onShareOne={() => makeLinkAndShare([t.id], "single")}
                  nowMs={nowMs}
                />
              ))}
            </div>
          </section>
        ))
      )}

      {/* R1 W1.1. Saved ids the database did not return. Never auto-removed. */}
      {missingIds.length > 0 && !selectMode ? (
        <section className="sbd-saved__group sbd-saved__missing">
          <div className="sbd-group-hdr">
            <span className="sbd-group-dot" style={{ background: "var(--ink-2)" }} />
            No longer listed
            <span className="sbd-group-hdr__chip">{missingIds.length}</span>
            <span className="sbd-group-hdr__rule" role="presentation" />
          </div>
          <p className="sbd-saved__pasthint">
            We kept these on your list. Remove one whenever you like.
          </p>
          <div className="sbd-saved__list">
            {missingIds.map((id) => (
              <MissingSavedCard
                key={id}
                title={lookup.get(id)?.title ?? null}
                onRemove={() => remove(id)}
              />
            ))}
          </div>
        </section>
      ) : null}

      {pastItems.length > 0 ? (
        <section className="sbd-saved__group sbd-saved__past">
          <div className="sbd-group-hdr">
            <span className="sbd-group-dot" style={{ background: "var(--ink-2)" }} />
            Past events
            <span className="sbd-group-hdr__chip">{pastItems.length}</span>
            <span className="sbd-group-hdr__rule" role="presentation" />
          </div>
          {/* R1 W7.1 (SAV-003). The card above already asks; do not ask twice. */}
          {!c2Item ? (
            <p className="sbd-saved__pasthint">Did you make it? Mark the ones you did.</p>
          ) : null}
          <div className="sbd-saved__list">
            {pastItems.map((t, i) => (
              <SavedCard
                key={t.id}
                thing={t}
                index={i}
                state={(state(t.id) ?? "want") as SaveState}
                selectMode={selectMode}
                selected={selected.has(t.id)}
                onToggleSelect={() => toggleSelect(t.id)}
                onSetState={(s) => handleSetState(t.id, s)}
                onRemove={() => remove(t.id)}
                onShareOne={() => makeLinkAndShare([t.id], "single")}
                nowMs={nowMs}
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* B1 bottom stack: Build a day → Share my list → Back up (C4 gated) */}
      {!selectMode ? (
        <div className="sbd-saved__bottom">
          <Link href="/plan" className="sbd-build-cta" aria-label="Build a day from your saved">
            <div className="sbd-build-cta__icon" aria-hidden="true"><SBIcon name="sun" size={22} strokeWidth={1.8} /></div>
            <div className="sbd-build-cta__body">
              <span className="sbd-build-cta__title">Build a day</span>
              <span className="sbd-build-cta__sub">Your saved spots, shaped into a plan.</span>
            </div>
            <span className="sbd-build-cta__arrow" aria-hidden="true"><SBIcon name="chevron" size={20} strokeWidth={2.2} /></span>
          </Link>

          <button
            type="button"
            className="sbd-share-list-btn"
            onClick={() => {
              setSelectMode(true);
              setSelected(new Set());
            }}
          >
            <span className="sbd-share-list-btn__chip" aria-hidden="true"><SBIcon name="share" size={14} /></span>
            Share my list
          </button>

          {/* R1 W1.4. Offered from the very first save, compact until five. */}
          {counts.total >= 1 ? <RestorePanel compact={counts.total < 5} /> : null}
        </div>
      ) : null}

      <NearMeSheet
        open={nearOpen}
        current={zone}
        onClose={() => setNearOpen(false)}
        onSelect={(z) => {
          setZone(z);
          setNearOpen(false);
        }}
      />

      {selectMode ? (
        <ShareBar
          count={selected.size}
          onShare={shareSelected}
          onCancel={() => {
            setSelectMode(false);
            setSelected(new Set());
          }}
        />
      ) : null}

      {shareSheet}

      {toast ? <div className="sbd-toast">{toast}</div> : null}

      {/* C3: Been acknowledgment toast */}
      {beenAck !== null ? (
        <div className="sbd-toast sbd-toast--been" role="status" aria-live="polite">
          <span className="sbd-toast__check" aria-hidden="true"><SBIcon name="check" size={14} /></span>{" "}
          Nice, that&apos;s {beenAck} SB {beenAck === 1 ? "spot" : "spots"} you&apos;ve made it to.
          <span className="sbd-toast__sub">{STAYS_ON_PHONE}</span>
        </div>
      ) : null}
    </div>
  );
}
