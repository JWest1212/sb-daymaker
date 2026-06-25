"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CockpitData } from "@/lib/reviewServer";
import type { QueueRow } from "@/lib/review";
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
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [leavingId, setLeavingId] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const pending = useRef(new Map<string, Pending>());
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const visible = useMemo(
    () => queue.filter((c) => filter === "all" || String(c.happening_tier) === filter),
    [queue, filter],
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

  const approve = useCallback((item: QueueRow) => {
    const index = queue.findIndex((c) => c.id === item.id);
    const opt = item.photo_options[picks[item.id] ?? 0];
    const photo = opt?.url ? { url: opt.url, source: opt.source } : undefined;
    commitAction([item.id], [{ item, index }], "Published", () =>
      post("/api/review/approve", { ids: [item.id], photo }));
  }, [queue, picks, commitAction]);

  const reject = useCallback((item: QueueRow) => {
    const index = queue.findIndex((c) => c.id === item.id);
    commitAction([item.id], [{ item, index }], "Rejected", () =>
      post("/api/review/reject", { id: item.id, reason: "founder reject" }));
  }, [queue, commitAction]);

  const bulkGreen = useCallback(() => {
    const greens = visible.filter((c) => c.chip === "green");
    if (!greens.length) { showToast("No green-chip items in this view"); return; }
    const removed = greens.map((item) => ({ item, index: queue.findIndex((c) => c.id === item.id) }));
    const ids = greens.map((g) => g.id);
    commitAction(ids, removed, "Published", () => post("/api/review/approve", { ids }));
  }, [visible, queue, showToast, commitAction]);

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
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const cur = visible[active];
      if (cur && editingId === cur.id && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
        e.preventDefault(); cycle(cur.id, e.key === "ArrowRight" ? "next" : "prev"); return;
      }
      const k = e.key.toLowerCase();
      if (k === "arrowdown") { e.preventDefault(); setActive((a) => Math.min(visible.length - 1, a + 1)); }
      else if (k === "arrowup") { e.preventDefault(); setActive((a) => Math.max(0, a - 1)); }
      else if (k === "a" && cur) { e.preventDefault(); approve(cur); }
      else if (k === "e" && cur) { e.preventDefault(); setEditingId((id) => (id === cur.id ? null : cur.id)); }
      else if (k === "r" && cur) { e.preventDefault(); reject(cur); }
      else if (k === "b") { e.preventDefault(); bulkGreen(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [visible, active, editingId, approve, reject, bulkGreen, cycle]);

  useEffect(() => { if (active >= visible.length) setActive(Math.max(0, visible.length - 1)); }, [visible.length, active]);

  const dropBreakdown = useMemo(() => {
    const by: Record<string, number> = {};
    for (const d of initial.drops) by[d.reason] = (by[d.reason] ?? 0) + 1;
    const names: Record<string, string> = { no_start: "no start-time", duplicate: "duplicate", no_title: "no title", no_address: "no address", no_source: "no source" };
    return Object.entries(by).map(([r, n]) => `${n} ${names[r] ?? r}`).join(", ");
  }, [initial.drops]);

  const down = initial.sources.filter((s) => s.status === "fail");

  return (
    <div className="sbd-cockpit">
      <div className="topbar">
        <div className="topbar-inner">
          <div className="brand"><span><span className="sb">SB</span> Daymaker</span><span className="kicker">Review Cockpit</span></div>
          <div className="topbar-stats">
            <div className="tstat"><b>{queue.length}</b><span>In queue</span></div>
            <div className="tstat dropped"><b>{initial.drops.length}</b><span>Dropped</span></div>
            <div className="tstat broken"><b>{down.length}</b><span>Source down</span></div>
          </div>
        </div>
      </div>

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
                key={item.id}
                item={item}
                active={i === active}
                editing={editingId === item.id}
                pickIndex={picks[item.id] ?? 0}
                fetching={fetchingId === item.id}
                leaving={leavingId === item.id}
                onAct={(kind) => {
                  if (kind === "approve") approve(item);
                  else if (kind === "reject") reject(item);
                  else setEditingId((id) => (id === item.id ? null : item.id));
                }}
                onCycle={(dir) => cycle(item.id, dir)}
                onTryFetch={() => tryFetch(item.id)}
                onSelect={() => setActive(i)}
              />
            ))
          )}
        </main>

        <aside className="side">
          <DroppedPanel drops={initial.drops} />
          <SourceHealth sources={initial.sources} />
          <div className="panel">
            <h3>Shortcuts</h3>
            <div className="keys">
              <div className="kr"><span className="kk">A</span> Approve &amp; publish</div>
              <div className="kr"><span className="kk">E</span> Edit inline, then approve</div>
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
    </div>
  );
}
