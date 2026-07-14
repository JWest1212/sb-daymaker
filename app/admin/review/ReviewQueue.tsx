"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CockpitData } from "@/lib/reviewServer";
import { filterTags, type EditPayload, type QueueRow, type ReviewDraft } from "@/lib/review";
import { ReviewCard } from "./ReviewCard";
import { DroppedPanel } from "./DroppedPanel";
import { SourceHealth } from "./SourceHealth";

const COMMIT_MS = 2600;
type Filter = "all" | "1" | "2" | "3";
interface Toast { msg: string; undo?: () => void; }
interface Pending { timer: ReturnType<typeof setTimeout>; commit: () => void; }

export function ReviewQueue({ initial }: { initial: CockpitData }) {
  const [queue, setQueue] = useState<QueueRow[]>(initial.queue);
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState<Filter>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [edits, setEdits] = useState<Record<string, ReviewDraft>>({});
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [heroOverride, setHeroOverride] = useState<Record<string, boolean>>({});
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const pending = useRef(new Map<string, Pending>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(
    () => queue.filter((c) => filter === "all" || String(c.happening_tier) === filter),
    [queue, filter],
  );
  // Clamp at render time (an approval can shrink the list under the cursor) —
  // no state write needed, the next explicit ↑/↓ press re-anchors `active`.
  const activeIdx = Math.min(active, Math.max(0, visible.length - 1));

  const isHero = useCallback(
    (item: QueueRow) => heroOverride[item.id] ?? item.hero_eligible,
    [heroOverride],
  );

  const showToast = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), COMMIT_MS);
  }, []);

  const post = (url: string, body: unknown) =>
    fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });

  /** Optimistically remove ids, schedule the server commit, offer Undo. */
  const commitAction = useCallback(
    (ids: string[], removed: { item: QueueRow; index: number }[], verb: string, run: () => void) => {
      const key = ids.join(",");
      setLeavingId(ids[0] ?? null);
      setTimeout(() => {
        setQueue((q) => q.filter((c) => !ids.includes(c.id)));
        setLeavingId(null);
      }, 180);
      const timer = setTimeout(() => { run(); pending.current.delete(key); }, COMMIT_MS);
      pending.current.set(key, { timer, commit: run });
      showToast(`${verb} ${removed.length === 1 ? removed[0].item.title : `${removed.length} items`}`, () => {
        clearTimeout(timer);
        pending.current.delete(key);
        setQueue((q) => {
          const next = [...q];
          for (const { item, index } of [...removed].sort((a, b) => a.index - b.index)) {
            next.splice(Math.min(index, next.length), 0, item);
          }
          return next;
        });
        setToast(null);
      });
    },
    [showToast],
  );

  /** Build the edit payload from a card's pending draft (only if one exists). */
  const editPayloadFor = useCallback((item: QueueRow): EditPayload | undefined => {
    const d = edits[item.id];
    if (!d) return undefined;
    const tags = filterTags(d.tags, { is_21_plus: item.is_21_plus, price_band: item.price_band });
    return {
      title: d.title.trim() || item.title,
      blurb: d.blurb.trim() || null,
      blurb_long: d.blurb_long.trim() || null,
      neighborhood: d.neighborhood || null,
      tags,
    };
  }, [edits]);

  // A single press: commit any pending edits + hero flag + chosen photo, then publish.
  // For a thing_edits overlay card, approve applies the edit to the LIVE row.
  const approve = useCallback((item: QueueRow) => {
    const index = queue.findIndex((c) => c.id === item.id);
    const opt = item.photo_options[picks[item.id] ?? 0];
    const photo = opt?.url ? { url: opt.url, source: opt.source } : undefined;
    const edits_ = editPayloadFor(item);
    if (item.overlay_id) {
      commitAction([item.id], [{ item, index }], "Replaced live", () =>
        post("/api/review/approve", { overlay_id: item.overlay_id, edits: edits_, photo, hero_eligible: isHero(item) }));
      return;
    }
    commitAction([item.id], [{ item, index }], "Published", () =>
      post("/api/review/approve", {
        ids: [item.id], photo, edits: edits_, hero_eligible: isHero(item),
      }));
  }, [queue, picks, commitAction, editPayloadFor, isHero]);

  // For an overlay card, reject discards the pending edit (live row untouched).
  const reject = useCallback((item: QueueRow) => {
    const index = queue.findIndex((c) => c.id === item.id);
    if (item.overlay_id) {
      commitAction([item.id], [{ item, index }], "Discarded edit", () =>
        post("/api/review/reject", { overlay_id: item.overlay_id, id: item.edit_of, reason: "founder discard" }));
      return;
    }
    commitAction([item.id], [{ item, index }], "Rejected", () =>
      post("/api/review/reject", { id: item.id, reason: "founder reject" }));
  }, [queue, commitAction]);

  const bulkGreen = useCallback(() => {
    const greens = visible.filter((c) => c.chip === "green" && !c.overlay_id);
    if (!greens.length) { showToast("No green-chip items in this view"); return; }
    const removed = greens.map((item) => ({ item, index: queue.findIndex((c) => c.id === item.id) }));
    const ids = greens.map((g) => g.id);
    commitAction(ids, removed, "Published", () => post("/api/review/approve", { ids }));
  }, [visible, queue, showToast, commitAction]);

  // Hero flag is metadata-only and applies immediately (no re-review, §1.7).
  const toggleHero = useCallback((item: QueueRow) => {
    const next = !isHero(item);
    setHeroOverride((h) => ({ ...h, [item.id]: next }));
    post("/api/admin/hero-eligible", { thing_id: item.id, hero_eligible: next });
    showToast(next ? `★ Hero-flagged ${item.title}` : `Removed hero flag`);
  }, [isHero, showToast]);

  const startEdit = useCallback((item: QueueRow) => {
    setEdits((e) => (e[item.id] ? e : {
      ...e,
      [item.id]: {
        title: item.title,
        blurb: item.blurb ?? "", blurb_long: item.blurb_long ?? "",
        neighborhood: item.neighborhood ?? "", tags: [...item.tags],
      },
    }));
    setEditingId(item.id);
  }, []);

  // Leaving edit mode keeps the pending draft in state — nothing is saved to the
  // server until Approve. There is no separate save step (§1.5).
  const exitEdit = useCallback(() => setEditingId(null), []);

  const updateDraft = useCallback((id: string, patch: Partial<ReviewDraft>) => {
    setEdits((e) => ({ ...e, [id]: { ...e[id], ...patch } }));
  }, []);

  const toggleTag = useCallback((id: string, tag: string) => {
    setEdits((e) => {
      const d = e[id];
      if (!d) return e;
      const tags = d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag];
      return { ...e, [id]: { ...d, tags } };
    });
  }, []);

  const cycle = useCallback((id: string, dir: "prev" | "next") => {
    setPicks((p) => {
      const item = queue.find((c) => c.id === id);
      const n = item?.photo_options.length ?? 0;
      if (!n) return p;
      const cur = p[id] ?? 0;
      return { ...p, [id]: (cur + (dir === "next" ? 1 : -1) + n) % n };
    });
  }, [queue]);

  const tryFetch = useCallback(async (id: string) => {
    setFetchingId(id);
    const res = await post("/api/review/image-fetch", { id }).then((r) => r.json()).catch(() => null);
    setFetchingId(null);
    // Fold the fetched candidates into the card so the picker appears
    // immediately (they're also persisted server-side to photo_options).
    if (res?.ok && Array.isArray(res.options) && res.options.length) {
      setQueue((q) => q.map((c) => (c.id === id ? { ...c, photo_options: res.options } : c)));
      setPicks((p) => ({ ...p, [id]: 0 }));
    }
    showToast(res?.message ?? "No image available yet.");
  }, [showToast]);

  // Flush any pending commits if the page is leaving (keepalive makes them land).
  useEffect(() => {
    const flush = () => pending.current.forEach((p) => { clearTimeout(p.timer); p.commit(); });
    window.addEventListener("beforeunload", flush);
    return () => window.removeEventListener("beforeunload", flush);
  }, []);

  // Keyboard map (re-bound on state change to avoid stale closures).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      // While a card is being edited: the focus guard above already blocks keys
      // typed into fields, so out-of-field shortcuts stay live. A commits the
      // pending edits + publishes in one press (mockup), H toggles hero, ←/→
      // cycle the photo, E/Esc leave edit mode (keeping the draft). R is withheld
      // so a mis-key can't reject a card you're actively editing.
      if (editingId) {
        const ed = queue.find((c) => c.id === editingId);
        const k = e.key.toLowerCase();
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); cycle(editingId, e.key === "ArrowRight" ? "next" : "prev"); }
        else if (e.key === "Escape" || k === "e") { e.preventDefault(); exitEdit(); }
        else if (k === "a" && ed) { e.preventDefault(); approve(ed); }
        else if (k === "h" && ed) { e.preventDefault(); toggleHero(ed); }
        return;
      }
      const cur = visible[activeIdx];
      const k = e.key.toLowerCase();
      if (k === "arrowdown") { e.preventDefault(); setActive(Math.min(visible.length - 1, activeIdx + 1)); }
      else if (k === "arrowup") { e.preventDefault(); setActive(Math.max(0, activeIdx - 1)); }
      else if (k === "a" && cur) { e.preventDefault(); approve(cur); }
      else if (k === "e" && cur) { e.preventDefault(); startEdit(cur); }
      else if (k === "h" && cur) { e.preventDefault(); toggleHero(cur); }
      else if (k === "r" && cur) { e.preventDefault(); reject(cur); }
      else if (k === "b") { e.preventDefault(); bulkGreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, activeIdx, editingId, queue, approve, reject, bulkGreen, cycle, startEdit, exitEdit, toggleHero]);

  const dropBreakdown = useMemo(() => {
    const by: Record<string, number> = {};
    for (const d of initial.drops) by[d.reason] = (by[d.reason] ?? 0) + 1;
    const names: Record<string, string> = { no_start: "no start-time", duplicate: "duplicate", no_title: "no title", no_address: "no address", no_source: "no source" };
    return Object.entries(by).map(([r, n]) => `${n} ${names[r] ?? r}`).join(", ");
  }, [initial.drops]);

  const down = initial.sources.filter((s) => s.status === "fail");

  return (
    <>
      <div className="digest">
        <div className="digest-card">
          <span className="stamp">Latest run</span>
          <span className="msg">
            <b>{queue.length}</b> in queue · <b>{initial.drops.length}</b> dropped
            {dropBreakdown ? ` (${dropBreakdown})` : ""}
            {down.length ? <> · <span className="broken-flag">{down.map((d) => d.source).join(", ")} down</span></> : ""}
          </span>
        </div>
      </div>

      <div className="wrap">
        <main>
          <div className="controls">
            <h1 className="qtitle">Review queue<span className="count">{visible.length} item{visible.length === 1 ? "" : "s"}</span></h1>
            <span className="spacer" />
            <div className="filterbar" role="group" aria-label="Filter queue">
              {(["all", "1", "2", "3"] as Filter[]).map((f) => (
                <button key={f} className="filt" aria-pressed={filter === f}
                  onClick={() => { setFilter(f); setActive(0); }}>
                  {f === "all" ? "All" : f === "1" ? "Events" : f === "2" ? "Recurring" : "Places"}
                </button>
              ))}
            </div>
            <button className="bulk" onClick={bulkGreen}>▣ Bulk-approve green <span style={{ fontFamily: "var(--font-mono)", fontSize: ".7rem", opacity: 0.7 }}>(B)</span></button>
          </div>

          {visible.length === 0 ? (
            <div className="done show">
              <div className="sun">☀️</div>
              <h2>Queue cleared</h2>
              <p>Nothing left to review. The next batch lands tomorrow at 2 a.m.</p>
            </div>
          ) : (
            visible.map((item, i) => (
              <ReviewCard
                key={item.overlay_id ?? item.id}
                item={item}
                active={i === activeIdx}
                editing={editingId === item.id}
                hero={isHero(item)}
                pickIndex={picks[item.id] ?? 0}
                fetching={fetchingId === item.id}
                leaving={leavingId === item.id}
                draft={edits[item.id] ?? null}
                onAct={(kind) => {
                  if (kind === "approve") approve(item);
                  else if (kind === "reject") reject(item);
                  else if (kind === "hero") toggleHero(item);
                  else if (editingId === item.id) exitEdit();
                  else startEdit(item);
                }}
                onCycle={(dir) => cycle(item.id, dir)}
                onTryFetch={() => tryFetch(item.id)}
                onDraftChange={(patch) => updateDraft(item.id, patch)}
                onToggleTag={(t) => toggleTag(item.id, t)}
                onToast={showToast}
                onSelect={() => setActive(i)}
              />
            ))
          )}
        </main>

        <aside className="side">
          <SourceHealth sources={initial.sources} />
          <DroppedPanel drops={initial.drops} />
          <div className="panel">
            <h3>Shortcuts</h3>
            <div className="keys">
              <div className="kr"><span className="kk">A</span> Approve — commits edits + publishes</div>
              <div className="kr"><span className="kk">E</span> Edit in place (title · blurb · tags · photo)</div>
              <div className="kr"><span className="kk">H</span> Toggle ★ Hero flag</div>
              <div className="kr"><span className="kk">R</span> Reject</div>
              <div className="kr"><span className="kk">↑↓</span> Move between cards</div>
              <div className="kr"><span className="kk">B</span> Bulk-approve green chips</div>
            </div>
          </div>
        </aside>
      </div>

      {toast ? (
        <div className="toast show" role="status">
          {toast.msg}
          {toast.undo ? <span className="undo" onClick={toast.undo} role="button" tabIndex={0}>Undo</span> : null}
        </div>
      ) : null}
    </>
  );
}
