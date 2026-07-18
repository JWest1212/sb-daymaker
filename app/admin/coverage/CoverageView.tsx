"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  shadeColumn, COVERAGE_WINDOWS, COVERAGE_FLOORS,
  type CoverageResult, type CoverageDim, type CoverageWindow,
  type CoverageCellItem, type CellShade,
} from "@/lib/coverage";
import type { SourceHealthItem } from "@/lib/sourcesServer";

const HEALTH_BADGE: Record<string, string> = { below_baseline: "fail", paused: "q", ok: "done" };
const HEALTH_LABEL: Record<string, string> = { below_baseline: "below baseline", paused: "paused", ok: "ok" };

interface Directive {
  id: string;
  scope_kind: string;
  scope_key: string;
  window_days: number;
  status: string;
  run_note: string | null;
  requested_at: string;
}

const WIN_LABEL: Record<CoverageWindow, string> = { 7: "next 7d", 14: "next 14d", 30: "next 30d", 45: "next 45d" };

export function CoverageView({
  initial, noZoneCount, sourceHealth,
}: {
  initial: CoverageResult; noZoneCount: number; sourceHealth: SourceHealthItem[];
}) {
  const [dim, setDim] = useState<CoverageDim>(initial.dim);
  const [cache, setCache] = useState<Record<CoverageDim, CoverageResult | null>>({
    vibe: initial.dim === "vibe" ? initial : null,
    zone: initial.dim === "zone" ? initial : null,
  });
  const [floorOn, setFloorOn] = useState(true);
  const [loading, setLoading] = useState(false);
  const [sel, setSel] = useState<{ key: string; label: string; window: CoverageWindow } | null>(null);
  const [cellItems, setCellItems] = useState<CoverageCellItem[] | null>(null);
  const [restockRow, setRestockRow] = useState<{ key: string; label: string } | null>(null);
  const [restockWindow, setRestockWindow] = useState<CoverageWindow>(30);
  const [restockWhen, setRestockWhen] = useState<"tonight" | "now">("tonight");
  const [directives, setDirectives] = useState<Directive[]>([]);
  const [toast, setToast] = useState<string | null>(null);

  const data = cache[dim];

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 3200);
  }, []);

  const loadDirectives = useCallback(() => {
    fetch("/api/admin/restock/list").then((r) => r.json()).then((d) => setDirectives(d?.directives ?? [])).catch(() => {});
  }, []);
  useEffect(() => { loadDirectives(); }, [loadDirectives]);

  const switchDim = useCallback(async (d: CoverageDim) => {
    setSel(null); setCellItems(null); setDim(d);
    if (!cache[d]) {
      setLoading(true);
      const res: CoverageResult | null = await fetch(`/api/admin/coverage?dim=${d}`).then((r) => r.json()).catch(() => null);
      setLoading(false);
      if (res) setCache((c) => ({ ...c, [d]: res }));
    }
  }, [cache]);

  // Esc closes the restock modal, then the drilldown (keyboard operability).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (restockRow) setRestockRow(null);
      else if (sel) { setSel(null); setCellItems(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [restockRow, sel]);

  const shades = useMemo(() => {
    const out = {} as Record<CoverageWindow, CellShade[]>;
    if (data) for (const w of COVERAGE_WINDOWS) out[w] = shadeColumn(data.rows.map((r) => r.windows[w]), w, floorOn);
    return out;
  }, [data, floorOn]);

  const openCell = useCallback(async (key: string, label: string, w: CoverageWindow) => {
    setSel({ key, label, window: w });
    setCellItems(null);
    const res = await fetch(`/api/admin/coverage/cell?dim=${dim}&key=${encodeURIComponent(key)}&window=${w}`)
      .then((r) => r.json()).catch(() => null);
    setCellItems(res?.items ?? []);
  }, [dim]);

  const confirmRestock = useCallback(async () => {
    if (!restockRow) return;
    const label = `${restockRow.label} · next ${restockWindow}d`;
    const body = { scope_kind: dim, scope_key: restockRow.key, window_days: restockWindow, when: restockWhen };
    const res = await fetch("/api/admin/restock", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    }).then((r) => r.json()).catch(() => null);
    setRestockRow(null);
    if (res?.dispatched) showToast(`Running now: ${label}, fresh candidates land in the queue in ~10–20 min.`);
    else if (res?.queued && res?.error) showToast(`Run-now dispatch failed (${res.error}). Queued for tonight instead.`);
    else if (res?.ok) showToast(`Queued restock: ${label}`);
    else showToast(res?.error ? `Restock failed: ${res.error}` : "Restock failed");
    loadDirectives();
  }, [restockRow, restockWindow, restockWhen, dim, showToast, loadDirectives]);

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 1180 }}>
      <div className="vhead">
        <h1 className="qtitle">Coverage</h1>
        <span className="spacer" />
        <Link href="/admin/coverage/neighborhood-sweep" className="btn btn-edit btn-sm">
          Neighborhood Sweep &rarr;
          {noZoneCount > 0 ? <span className="nozone-badge">{noZoneCount} no zone</span> : null}
        </Link>
        <Link href="/admin/coverage/recurring-rhythms" className="btn btn-edit btn-sm">
          Recurring Rhythms &rarr;
        </Link>
        <Link href="/admin/coverage/sources" className="btn btn-edit btn-sm">
          Sources &rarr;
          {sourceHealth.filter((s) => s.health !== "ok").length > 0 ? (
            <span className="nozone-badge">{sourceHealth.filter((s) => s.health !== "ok").length} flagged</span>
          ) : null}
        </Link>
        <div className="filterbar" role="group" aria-label="Coverage dimension">
          <button className="filt" aria-pressed={dim === "vibe"} onClick={() => switchDim("vibe")}>By vibe</button>
          <button className="filt" aria-pressed={dim === "zone"} onClick={() => switchDim("zone")}>By neighborhood</button>
        </div>
      </div>
      <p className="vsub">Published Tier 1 + Tier 2 occurrences per window, cumulative from today. Click a cell to see what&apos;s in it.</p>

      <div className="covlayout">
        <div>
          <div className="covwrap">
            {loading || !data ? (
              <div className="covempty">Loading coverage…</div>
            ) : (
              <div className="covgrid">
                <div className="cov-h" />
                {COVERAGE_WINDOWS.map((w) => <div key={w} className="cov-h win">{WIN_LABEL[w]}</div>)}
                <div className="cov-h" />
                {data.rows.map((row, ri) => (
                  <div className="cov-rowgroup" key={row.key}>
                    <div className="cov-row-label">
                      <span className="rl">{row.label}</span>
                      <span className="rs">{row.evergreen} evergreen behind it</span>
                    </div>
                    {COVERAGE_WINDOWS.map((w) => {
                      const n = row.windows[w];
                      const sh = shades[w]?.[ri] ?? { rag: "r", deep: false };
                      const picked = sel?.key === row.key && sel?.window === w;
                      return (
                        <button
                          key={w}
                          className={`cell ${sh.rag}${sh.deep ? " deep" : ""}${picked ? " is-picked" : ""}`}
                          onClick={() => openCell(row.key, row.label, w)}
                          aria-label={`${row.label}, ${WIN_LABEL[w]}: ${n} ${n === 1 ? "occurrence" : "occurrences"}${floorOn && n < COVERAGE_FLOORS[w] ? " (below floor)" : ""}`}
                        >
                          <span className="cn">{n}</span>
                          <span className="cd" />
                        </button>
                      );
                    })}
                    <div className="restockcell">
                      <button className="restock" onClick={() => { setRestockRow({ key: row.key, label: row.label }); setRestockWindow(30); setRestockWhen("tonight"); }}>
                        ↻ Restock
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="covlegend">
              <span className="lg"><span className="sw" style={{ background: "var(--rag-red)" }} />thin, restock</span>
              <span className="lg"><span className="sw" style={{ background: "var(--rag-amber)" }} />okay</span>
              <span className="lg"><span className="sw" style={{ background: "var(--rag-green)" }} />stocked</span>
              <span className="legnote">shading is relative within each column</span>
              <label className="floorchk">
                <input type="checkbox" checked={floorOn} onChange={(e) => setFloorOn(e.target.checked)} />
                Absolute floor (7d&lt;3 · 14d&lt;5 · 30d&lt;8 · 45d&lt;10 always red)
              </label>
            </div>

            {sel ? (
              <div className="drill show">
                <h3>
                  {sel.label} · {WIN_LABEL[sel.window]}
                  <button className="x" aria-label="Close details" onClick={() => { setSel(null); setCellItems(null); }}>✕</button>
                </h3>
                {cellItems == null ? (
                  <div className="empty">Loading…</div>
                ) : cellItems.length === 0 ? (
                  <div className="empty">
                    Nothing scheduled here in this window, this is exactly what Restock is for.
                    Use the ↻ button on the <b>{sel.label}</b> row to queue a targeted fetch for tonight.
                  </div>
                ) : (
                  cellItems.map((it) => (
                    <div className="drow" key={it.id}>
                      <span className={`tier t${it.tier}`}>T{it.tier}</span>
                      <span className="dtitle">{it.title}</span>
                      <span className="dcount">{it.occurrences}×</span>
                      <span className="dw">{it.when}</span>
                    </div>
                  ))
                )}
              </div>
            ) : null}
          </div>
        </div>

        <aside className="side">
          <div className="panel">
            <h3>Restock directives <span className="n">{directives.length}</span></h3>
            <div className="dirlist">
              {directives.length === 0 ? (
                <div className="dirrow"><span className="ps">No directives yet. Use ↻ Restock on a thin row.</span></div>
              ) : directives.map((d) => (
                <div className="dirrow" key={d.id}>
                  <span className="dt">{d.scope_key.replace(/_/g, " ")} · next {d.window_days}d</span>
                  <span className={`dirstat ${d.status === "queued" ? "q" : d.status === "running" ? "run" : d.status === "done" ? "done" : "fail"}`}>{d.status}</span>
                  {d.run_note ? <span className="ps">{d.run_note}</span> : null}
                </div>
              ))}
            </div>
          </div>

          <div className="panel" style={{ marginTop: 16 }}>
            <h3>Source health <span className="n">{sourceHealth.filter((s) => s.health !== "ok").length} flagged</span></h3>
            <div className="dirlist">
              {sourceHealth.length === 0 ? (
                <div className="dirrow"><span className="ps">No sources yet.</span></div>
              ) : sourceHealth.map((s) => (
                <div className="dirrow" key={s.key}>
                  <span className="dt">{s.label}</span>
                  <span className={`dirstat ${HEALTH_BADGE[s.health] ?? "q"}`}>{HEALTH_LABEL[s.health] ?? s.health}</span>
                  <span className="ps">
                    {s.last_yield ?? "·"} last · baseline {s.expected_yield || "·"}
                    {s.consecutive_empty > 0 ? ` · ${s.consecutive_empty} empty in a row` : ""}
                    {s.last_ok_at ? ` · last ok ${s.last_ok_at.slice(0, 10)}` : " · never run"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      {restockRow ? (
        <>
          <div className="scrim show" onClick={() => setRestockRow(null)} />
          <div className="sheet show" role="dialog" aria-modal="true" aria-labelledby="rsTitle">
            <h3 id="rsTitle">Restock<button className="x" aria-label="Close" onClick={() => setRestockRow(null)}>✕</button></h3>
            <div className="sbody">
              <div style={{ fontSize: ".92rem" }}>
                Find more <b>{restockRow.label}</b> things for the{" "}
                <select className="edit-select" style={{ maxWidth: 120, display: "inline-block" }}
                  value={restockWindow} onChange={(e) => setRestockWindow(Number(e.target.value) as CoverageWindow)}>
                  {COVERAGE_WINDOWS.map((w) => <option key={w} value={w}>next {w} days</option>)}
                </select>
              </div>
              <label className={`radio${restockWhen === "tonight" ? " sel" : ""}`}>
                <input type="radio" name="rswhen" checked={restockWhen === "tonight"} onChange={() => setRestockWhen("tonight")} />
                <span><span className="rt">Queue for tonight&apos;s run</span><br />
                  <span className="rd">The 2 a.m. pipeline targets this gap across the full source catalogue. Results land in tomorrow&apos;s review queue. No new cost path.</span></span>
              </label>
              <label className={`radio${restockWhen === "now" ? " sel" : ""}`}>
                <input type="radio" name="rswhen" checked={restockWhen === "now"} onChange={() => setRestockWhen("now")} />
                <span><span className="rt">Run now</span><br />
                  <span className="rd">Dispatches the ingest worker on demand (~10–20 min) via a fresh pass across all sources. Real API spend, use it for urgent gaps; the nightly queue is free.</span></span>
              </label>
              <div className="gatebox">Everything found passes the same gate as the nightly run, deterministic start-time required, dedupe against the DB, category + zone checks, and arrives in your <b>review queue</b>. Nothing goes live without your approval.</div>
            </div>
            <div className="sfoot">
              <button className="btn btn-edit" onClick={() => setRestockRow(null)}>Cancel</button>
              <button className="btn btn-approve" onClick={confirmRestock}>{restockWhen === "now" ? "Run now" : "Queue restock"}</button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
