"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Thing } from "@/lib/things";
import { nearMeSort } from "@/lib/explore";
import { filterByState, splitPast, beenList } from "@/lib/savedView";
import { groupSaved } from "@/lib/savedGroups";
import type { Zone } from "@/lib/zones";
import { ZONE_LABEL } from "@/lib/zones";
import { useSaves, type SaveState } from "@/components/saves/SavesProvider";
import { useTour } from "@/components/tour/useTour";
import { EmptyState, SBIcon } from "@/components/ui";
import { SavedToggle } from "./SavedToggle";
import { NearMeSheet } from "@/components/explore/NearMeSheet";
import { createSharedList } from "@/lib/shares";
import { trackEvent } from "@/lib/analytics";
import { SavedCard } from "./SavedCard";
import { ShareBar } from "./ShareBar";
import { RestorePanel } from "./RestorePanel";
import { MemoryRecap } from "./MemoryRecap";
import { shareUrl } from "./share";

const WORDS = ["One","Two","Three","Four","Five","Six","Seven","Eight","Nine"];
function spellCount(n: number): string {
  return n >= 1 && n <= 9 ? WORDS[n - 1] : String(n);
}

function relativeDayLabel(pastMs: number, nowMs: number): string {
  const diffDays = (nowMs - pastMs) / (1000 * 60 * 60 * 24);
  const d = new Date(pastMs);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  if (diffDays < 1.5) return "Last night";
  if (dow === 0 || dow === 6) return "This past weekend";
  if (diffDays < 7) return "Earlier this week";
  return "Recently";
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

export function SavedClient({ things }: { things: Thing[] }) {
  const { ids, saves, state, setState, remove, counts } = useSaves();
  const { openTour } = useTour();

  const [stateFilter, setStateFilter] = useState<SaveState>("want");
  const [zone, setZone] = useState<Zone | null>(null);
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

  // Remove ghost saves that no longer exist in the data pool.
  useEffect(() => {
    if (things.length === 0 || things.length >= 1000) return;
    const live = new Set(things.map((t) => t.id));
    for (const id of ids) if (!live.has(id)) remove(id);
  }, [things, ids, remove]);

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
  const groups = useMemo(() => groupSaved(mainItems), [mainItems]);

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
    const result = await shareUrl(url, "My Santa Barbara picks");
    setToast(
      result === "shared"
        ? "Shared!"
        : result === "copied"
          ? "Link copied to clipboard"
          : `Link ready: ${url}`,
    );
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
    const noun = listCount === 1 ? "spot" : "spots";
    const sub =
      weekendCount > 0
        ? `${spellCount(weekendCount)} happening this weekend · kept on your phone, no account`
        : "Kept on your phone, no account";
    return { main: `${n} ${noun} on your list`, sub };
  }, [listCount, stateFilter, weekendCount]);

  // --- Empty state (0 total saves) ---
  if (counts.total === 0) {
    return (
      <div style={{ paddingTop: "var(--space-6)" }}>
        <EmptyState
          icon="❤️"
          title="Your saved list"
          message="Nothing saved yet. Tap the heart on anything you love and it'll live right here, on this device, no account needed."
          action={
            <button
              type="button"
              className="sbd-tour-replay sbd-tour-replay--saved"
              aria-haspopup="dialog"
              onClick={openTour}
            >
              <SBIcon name="reset" size={14} />
              New here? See how it works
            </button>
          }
        />
      </div>
    );
  }

  return (
    <div className="sbd-saved">
      {/* T2: Want / Been toggle + A1 Near Me (only at ≥4 in-view) */}
      <div className="sbd-saved__controls">
        <SavedToggle
          value={stateFilter}
          wantCount={counts.want}
          beenCount={counts.been}
          onChange={(v) => setStateFilter(v)}
        />
        {listCount >= 4 ? (
          <div className="sbd-saved__tools">
            <button
              type="button"
              className={`sbd-ctrl__near${zone ? " is-active" : ""}`}
              onClick={() => setNearOpen(true)}
            >
              <span aria-hidden="true">📍</span>
              <span>{zone ? ZONE_LABEL[zone] : "Near Me"}</span>
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
          <p className="sbd-c2__eyebrow">{relativeDayLabel(new Date(c2Item.starts_at!).getTime(), nowMs)}</p>
          <div className="sbd-c2__content">
            {c2Item.photo_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="sbd-c2__thumb" src={c2Item.photo_url} alt="" loading="lazy" />
            ) : null}
            <p className="sbd-c2__question">Did you make it to {c2Item.title}?</p>
          </div>
          <p className="sbd-c2__sub">
            {"Mark what you did. It's how SB Daymaker learns your Santa Barbara."}
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
              ✓ Yes, I went
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

      {viewItems.length === 0 ? (
        stateFilter === "been" ? null : (
          <EmptyState icon="❤️" message="Nothing in your want-to-go list right now." />
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
                />
              ))}
            </div>
          </section>
        ))
      )}

      {pastItems.length > 0 ? (
        <section className="sbd-saved__group sbd-saved__past">
          <div className="sbd-group-hdr">
            <span className="sbd-group-dot" style={{ background: "var(--ink-2)" }} />
            Past events
            <span className="sbd-group-hdr__chip">{pastItems.length}</span>
            <span className="sbd-group-hdr__rule" role="presentation" />
          </div>
          <p className="sbd-saved__pasthint">Did you make it? Mark the ones you did.</p>
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
              />
            ))}
          </div>
        </section>
      ) : null}

      {/* B1 bottom stack: Build a day → Share my list → Back up (C4 gated) */}
      {!selectMode ? (
        <div className="sbd-saved__bottom">
          <Link href="/plan" className="sbd-build-cta" aria-label="Build a day from your saved">
            <div className="sbd-build-cta__icon" aria-hidden="true">☀️</div>
            <div className="sbd-build-cta__body">
              <span className="sbd-build-cta__title">Build a day</span>
              <span className="sbd-build-cta__sub">Your saved spots, shaped into a plan.</span>
            </div>
            <span className="sbd-build-cta__arrow" aria-hidden="true">→</span>
          </Link>

          <button
            type="button"
            className="sbd-share-list-btn"
            onClick={() => {
              setSelectMode(true);
              setSelected(new Set());
            }}
          >
            <span className="sbd-share-list-btn__chip" aria-hidden="true">↗</span>
            Share my list
          </button>

          {counts.total >= 5 ? <RestorePanel /> : null}
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

      {toast ? <div className="sbd-toast">{toast}</div> : null}

      {/* C3: Been acknowledgment toast */}
      {beenAck !== null ? (
        <div className="sbd-toast sbd-toast--been" role="status" aria-live="polite">
          <span className="sbd-toast__check" aria-hidden="true">✓</span>{" "}
          Nice, that&apos;s {beenAck} SB {beenAck === 1 ? "spot" : "spots"} you&apos;ve made it to.
          <span className="sbd-toast__sub">Quietly building your Santa Barbara.</span>
        </div>
      ) : null}
    </div>
  );
}
