"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import type { SourceRow } from "@/lib/sourcesServer";
import { titleCaseLabel } from "@/lib/recurringRhythms";

const LANES = ["structured", "generic", "render"];
const FREQUENCIES = ["nightly", "weekly", "reserve"];

interface FormState {
  key: string;
  label: string;
  url: string;
  authority: string; // text input, parsed on save
  crawlFrequency: string;
  lane: string;
  notes: string;
}

const BLANK_FORM: FormState = { key: "", label: "", url: "", authority: "0.70", crawlFrequency: "nightly", lane: "structured", notes: "" };

function rowToForm(r: SourceRow): FormState {
  return {
    key: r.key, label: r.label, url: r.url ?? "", authority: String(r.authority),
    crawlFrequency: r.crawl_frequency, lane: r.lane, notes: r.notes ?? "",
  };
}

function statusBadgeClass(status: string): string {
  if (status === "active") return "done";
  if (status === "candidate") return "q";
  if (status === "paused") return "run";
  return "fail"; // retired
}

export function SourcesView({ initialSources }: { initialSources: SourceRow[] }) {
  const [sources, setSources] = useState(initialSources);
  const [sheetTarget, setSheetTarget] = useState<SourceRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/coverage/sources").then((r) => r.json()).catch(() => null);
    if (res?.sources) setSources(res.sources);
  }, []);

  const openAdd = useCallback(() => { setForm(BLANK_FORM); setSheetTarget("new"); }, []);
  const openEdit = useCallback((r: SourceRow) => { setForm(rowToForm(r)); setSheetTarget(r); }, []);
  const closeSheet = useCallback(() => setSheetTarget(null), []);

  const setStatus = useCallback(async (r: SourceRow, status: string) => {
    setBusyKey(r.key);
    const res = await fetch(`/api/admin/coverage/sources/${encodeURIComponent(r.key)}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ status }),
    }).then((res2) => res2.json()).catch(() => null);
    setBusyKey(null);
    if (res?.ok) {
      setSources((rows) => rows.map((row) => (row.key === r.key ? { ...row, status } : row)));
      showToast(`${r.label} → ${status}. Next nightly run picks this up — no deploy needed.`);
    } else {
      showToast(res?.error ? `Update failed: ${res.error}` : "Update failed.");
    }
  }, [showToast]);

  const save = useCallback(async () => {
    const authorityNum = Number(form.authority);
    if (Number.isNaN(authorityNum) || authorityNum < 0 || authorityNum > 1) {
      showToast("Authority must be a number between 0 and 1.");
      return;
    }
    if (!form.label.trim()) { showToast("Label is required."); return; }
    setSaving(true);
    const isNew = sheetTarget === "new";
    if (isNew) {
      if (!form.key.trim()) { setSaving(false); showToast("Key is required."); return; }
      const res = await fetch("/api/admin/coverage/sources", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ key: form.key, label: form.label, url: form.url, authority: authorityNum, lane: form.lane }),
      }).then((r) => r.json()).catch(() => null);
      setSaving(false);
      if (res?.ok) { showToast(`Added ${form.label} as a candidate.`); setSheetTarget(null); refresh(); }
      else showToast(res?.error ? `Add failed: ${res.error}` : "Add failed.");
    } else {
      const key = (sheetTarget as SourceRow).key;
      const res = await fetch(`/api/admin/coverage/sources/${encodeURIComponent(key)}`, {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: form.label, url: form.url, authority: authorityNum,
          crawl_frequency: form.crawlFrequency, notes: form.notes,
        }),
      }).then((r) => r.json()).catch(() => null);
      setSaving(false);
      if (res?.ok) { showToast(`Saved ${form.label}.`); setSheetTarget(null); refresh(); }
      else showToast(res?.error ? `Save failed: ${res.error}` : "Save failed.");
    }
  }, [form, sheetTarget, showToast, refresh]);

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 1080 }}>
      <div className="sweep-head">
        <Link href="/admin/coverage" style={{ fontSize: ".78rem", color: "var(--pacific)" }}>&larr; Coverage</Link>
        <h1 className="qtitle" style={{ marginTop: 6 }}>Sources</h1>
        <p className="sub">
          Every place events come from — how much each is trusted, how it&apos;s doing against its own
          normal yield, and whether it&apos;s running. Pause, resume, retire, or add a candidate here —
          the next nightly run picks up the change, no deploy. Adding a candidate registers it for
          tracking; it does not start fetching on its own until a code adapter (or a future generic
          extraction lane) exists for that key.
        </p>
      </div>

      <section className="card">
        <div className="sweep-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{sources.length} source{sources.length === 1 ? "" : "s"}</h2>
            <button className="btn btn-approve" onClick={openAdd}>+ Add a candidate</button>
          </div>

          <table className="sweep-dtable" style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Source</th><th>Lane</th><th>Authority</th><th>Yield (last / baseline)</th><th>Empty streak</th><th>Status</th><th /></tr>
            </thead>
            <tbody>
              {sources.map((r) => (
                <tr key={r.key} className={r.status === "active" ? undefined : "rr-inactive-row"}>
                  <td>
                    <div className="venue">{r.label}</div>
                    <div className="aliases">{r.key}</div>
                  </td>
                  <td>{titleCaseLabel(r.lane)}{r.parse_method ? ` · ${r.parse_method}` : ""}</td>
                  <td>{r.authority.toFixed(2)}</td>
                  <td>{r.last_yield ?? "—"} / {r.expected_yield || "—"}</td>
                  <td>{r.consecutive_empty > 0 ? r.consecutive_empty : "—"}</td>
                  <td><span className={`dirstat ${statusBadgeClass(r.status)}`}>{r.status}</span></td>
                  <td style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <button className="btn btn-edit btn-sm" onClick={() => openEdit(r)}>Edit</button>
                    {r.status === "active" ? (
                      <button className="btn btn-edit btn-sm" disabled={busyKey === r.key} onClick={() => setStatus(r, "paused")}>Pause</button>
                    ) : r.status !== "retired" ? (
                      <button className="btn btn-edit btn-sm" disabled={busyKey === r.key} onClick={() => setStatus(r, "active")}>{r.status === "candidate" ? "Activate" : "Resume"}</button>
                    ) : null}
                    {r.status !== "retired" ? (
                      <button className="btn btn-edit btn-sm" disabled={busyKey === r.key} onClick={() => setStatus(r, "retired")}>Retire</button>
                    ) : null}
                  </td>
                </tr>
              ))}
              {sources.length === 0 ? (
                <tr><td colSpan={7}>No sources yet.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {sheetTarget ? (
        <>
          <div className="scrim show" onClick={closeSheet} />
          <div className="sheet show" role="dialog" aria-modal="true" aria-labelledby="srcTitle">
            <h3 id="srcTitle">
              {sheetTarget === "new" ? "Add a candidate source" : `Edit ${(sheetTarget as SourceRow).label}`}
              <button className="x" aria-label="Close" onClick={closeSheet}>✕</button>
            </h3>
            <div className="sbody">
              {sheetTarget === "new" ? (
                <label className="editlabel">Key (stable machine id — matches a future adapter's key)
                  <input className="edit-input" type="text" value={form.key} onChange={(e) => setForm({ ...form, key: e.target.value })} placeholder="e.g. sbNewVenue" />
                </label>
              ) : null}
              <label className="editlabel">Label
                <input className="edit-input" type="text" value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
              </label>
              <label className="editlabel">URL
                <input className="edit-input" type="url" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} />
              </label>
              <div className="rr-dayrow">
                <label className="editlabel">Authority (0–1, how much dedupe trusts this source)
                  <input className="edit-input" type="number" min={0} max={1} step={0.01} value={form.authority} onChange={(e) => setForm({ ...form, authority: e.target.value })} />
                </label>
                {sheetTarget === "new" ? (
                  <label className="editlabel">Lane
                    <select className="edit-select" value={form.lane} onChange={(e) => setForm({ ...form, lane: e.target.value })}>
                      {LANES.map((l) => <option key={l} value={l}>{titleCaseLabel(l)}</option>)}
                    </select>
                  </label>
                ) : (
                  <label className="editlabel">Crawl frequency (data only for now — per-source scheduling isn&apos;t wired into the pipeline yet)
                    <select className="edit-select" value={form.crawlFrequency} onChange={(e) => setForm({ ...form, crawlFrequency: e.target.value })}>
                      {FREQUENCIES.map((f) => <option key={f} value={f}>{titleCaseLabel(f)}</option>)}
                    </select>
                  </label>
                )}
              </div>
              {sheetTarget !== "new" ? (
                <label className="editlabel">Notes
                  <textarea className="edit-textarea" rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                </label>
              ) : null}
            </div>
            <div className="sfoot">
              <button className="btn btn-edit" onClick={closeSheet}>Cancel</button>
              <button className="btn btn-approve" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save"}</button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
