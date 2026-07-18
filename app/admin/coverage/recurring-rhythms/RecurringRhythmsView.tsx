"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { RecurringRhythmRow, RecurringRhythmDay } from "@/lib/recurringRhythms";
import { RECURRING_CATEGORIES, RECUR_FREQUENCIES, DOW_LABELS, titleCaseLabel, formatDayTime } from "@/lib/recurringRhythms";
import { NEIGHBORHOODS, OCCASION_TAGS } from "@/lib/review";

interface FormState {
  title: string;
  venue: string;
  address: string;
  neighborhood: string;
  category: string;
  reasonToGo: string;
  frequency: string;
  sourceUrl: string;
  dow: number;
  start: string; // '' = unknown
  end: string;
  timeUnknown: boolean;
  occasionTags: string[];
}

const BLANK_FORM: FormState = {
  title: "", venue: "", address: "", neighborhood: NEIGHBORHOODS[0], category: RECURRING_CATEGORIES[0],
  reasonToGo: "", frequency: "weekly", sourceUrl: "", dow: 6, start: "", end: "", timeUnknown: false,
  occasionTags: [],
};

function rowToForm(r: RecurringRhythmRow): FormState {
  const d: RecurringRhythmDay = r.days[0] ?? { dow: 0, start: null, end: null };
  return {
    title: r.title, venue: r.venue, address: r.address, neighborhood: r.neighborhood, category: r.category,
    reasonToGo: r.reason_to_go, frequency: r.frequency, sourceUrl: r.source_url,
    dow: d.dow, start: d.start ?? "", end: d.end ?? "", timeUnknown: d.start == null,
    occasionTags: r.occasion_tags ?? [],
  };
}

export function RecurringRhythmsView({ initialRhythms }: { initialRhythms: RecurringRhythmRow[] }) {
  const [rhythms, setRhythms] = useState(initialRhythms);
  const [sheetTarget, setSheetTarget] = useState<RecurringRhythmRow | "new" | null>(null);
  const [form, setForm] = useState<FormState>(BLANK_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/admin/coverage/recurring-rhythms").then((r) => r.json()).catch(() => null);
    if (res?.rhythms) setRhythms(res.rhythms);
  }, []);

  const openAdd = useCallback(() => { setForm(BLANK_FORM); setSheetTarget("new"); }, []);
  const openEdit = useCallback((r: RecurringRhythmRow) => { setForm(rowToForm(r)); setSheetTarget(r); }, []);
  const closeSheet = useCallback(() => setSheetTarget(null), []);

  const toggleActive = useCallback(async (r: RecurringRhythmRow) => {
    setTogglingId(r.id);
    const res = await fetch(`/api/admin/coverage/recurring-rhythms/${r.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ active: !r.active }),
    }).then((res2) => res2.json()).catch(() => null);
    setTogglingId(null);
    if (res?.ok) {
      setRhythms((rows) => rows.map((row) => (row.id === r.id ? { ...row, active: !r.active } : row)));
      showToast(!r.active ? `${r.title} is active, next nightly run includes it.` : `${r.title} turned off, next nightly run skips it.`);
    } else {
      showToast(res?.error ? `Toggle failed: ${res.error}` : "Toggle failed.");
    }
  }, [showToast]);

  const save = useCallback(async () => {
    if (!form.title.trim() || !form.venue.trim() || !form.address.trim() || !form.sourceUrl.trim()) {
      showToast("Title, venue, address, and source URL are required.");
      return;
    }
    setSaving(true);
    const day = { dow: form.dow, start: form.timeUnknown ? null : (form.start || null), end: form.timeUnknown ? null : (form.end || null) };
    const payload = {
      title: form.title, venue: form.venue, address: form.address, neighborhood: form.neighborhood,
      category: form.category, reasonToGo: form.reasonToGo, frequency: form.frequency, sourceUrl: form.sourceUrl,
      day, occasionTags: form.occasionTags,
    };
    const isNew = sheetTarget === "new";
    const url = isNew ? "/api/admin/coverage/recurring-rhythms" : `/api/admin/coverage/recurring-rhythms/${(sheetTarget as RecurringRhythmRow).id}`;
    const res = await fetch(url, {
      method: isNew ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload),
    }).then((r) => r.json()).catch(() => null);
    setSaving(false);
    if (res?.ok) {
      showToast(isNew ? `Added ${form.title}.` : `Saved ${form.title}.`);
      setSheetTarget(null);
      refresh();
    } else {
      showToast(res?.error ? `Save failed: ${res.error}` : "Save failed.");
    }
  }, [form, sheetTarget, showToast, refresh]);

  const toggleTag = useCallback((tag: string) => {
    setForm((f) => ({
      ...f,
      occasionTags: f.occasionTags.includes(tag) ? f.occasionTags.filter((t) => t !== tag) : [...f.occasionTags, tag],
    }));
  }, []);

  const sorted = useMemo(
    () => [...rhythms].sort((a, b) => (a.active === b.active ? a.title.localeCompare(b.title) : a.active ? -1 : 1)),
    [rhythms],
  );

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 960 }}>
      <div className="sweep-head">
        <Link href="/admin/coverage" style={{ fontSize: ".78rem", color: "var(--pacific)" }}>&larr; Coverage</Link>
        <h1 className="qtitle" style={{ marginTop: 6 }}>Recurring Rhythms</h1>
        <p className="sub">
          The standing weekly / biweekly / monthly happenings the scrapers can&apos;t reliably find, farmers&apos; markets, live-music nights, art walks. Add or edit here; the next nightly run
          picks it up, no code change.
        </p>
      </div>

      <section className="card">
        <div className="sweep-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0 }}>{sorted.length} rhythm{sorted.length === 1 ? "" : "s"}</h2>
            <button className="btn btn-approve" onClick={openAdd}>+ Add a rhythm</button>
          </div>

          <table className="sweep-dtable" style={{ marginTop: 12 }}>
            <thead>
              <tr><th>Rhythm</th><th>When</th><th>Category</th><th>Active</th><th /></tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className={r.active ? undefined : "rr-inactive-row"}>
                  <td>
                    <div className="venue">{r.title}</div>
                    <div className="aliases">{r.venue} &middot; {titleCaseLabel(r.neighborhood)}</div>
                  </td>
                  <td>{formatDayTime(r.frequency, r.days[0] ?? { dow: 0, start: null, end: null })}</td>
                  <td><span className="zpill">{titleCaseLabel(r.category)}</span></td>
                  <td>
                    <label className="chk">
                      <input
                        type="checkbox" checked={r.active} disabled={togglingId === r.id}
                        onChange={() => toggleActive(r)} aria-label={`${r.active ? "Deactivate" : "Activate"} ${r.title}`}
                      />
                      {r.active ? "On" : "Off"}
                    </label>
                  </td>
                  <td><button className="btn btn-edit btn-sm" onClick={() => openEdit(r)}>Edit</button></td>
                </tr>
              ))}
              {sorted.length === 0 ? (
                <tr><td colSpan={5}>No rhythms yet, add the first one above.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>

      {sheetTarget ? (
        <>
          <div className="scrim show" onClick={closeSheet} />
          <div className="sheet show" role="dialog" aria-modal="true" aria-labelledby="rrTitle">
            <h3 id="rrTitle">
              {sheetTarget === "new" ? "Add a rhythm" : `Edit ${(sheetTarget as RecurringRhythmRow).title}`}
              <button className="x" aria-label="Close" onClick={closeSheet}>✕</button>
            </h3>
            <div className="sbody">
              <label className="editlabel">Title
                <input className="edit-input" type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </label>
              <div className="rr-dayrow">
                <label className="editlabel">Venue
                  <input className="edit-input" type="text" value={form.venue} onChange={(e) => setForm({ ...form, venue: e.target.value })} />
                </label>
                <label className="editlabel">Address
                  <input className="edit-input" type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
                </label>
              </div>
              <div className="rr-dayrow">
                <label className="editlabel">Neighborhood
                  <select className="edit-select" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })}>
                    {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{titleCaseLabel(n)}</option>)}
                  </select>
                </label>
                <label className="editlabel">Category
                  <select className="edit-select" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
                    {RECURRING_CATEGORIES.map((c) => <option key={c} value={c}>{titleCaseLabel(c)}</option>)}
                  </select>
                </label>
              </div>
              <label className="editlabel">Reason to go
                <textarea className="edit-textarea" rows={2} value={form.reasonToGo} onChange={(e) => setForm({ ...form, reasonToGo: e.target.value })} />
              </label>
              <div className="rr-dayrow">
                <label className="editlabel">Frequency
                  <select className="edit-select" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
                    {RECUR_FREQUENCIES.map((f) => <option key={f} value={f}>{titleCaseLabel(f)}</option>)}
                  </select>
                </label>
                <label className="editlabel">Day of week
                  <select className="edit-select" value={form.dow} onChange={(e) => setForm({ ...form, dow: Number(e.target.value) })}>
                    {DOW_LABELS.map((d, i) => <option key={d} value={i}>{d}</option>)}
                  </select>
                </label>
              </div>
              <div className="rr-dayrow">
                <label className="editlabel">Start time
                  <input className="edit-input" type="time" value={form.start} disabled={form.timeUnknown}
                    onChange={(e) => setForm({ ...form, start: e.target.value })} />
                </label>
                <label className="editlabel">End time
                  <input className="edit-input" type="time" value={form.end} disabled={form.timeUnknown}
                    onChange={(e) => setForm({ ...form, end: e.target.value })} />
                </label>
              </div>
              <label className="chk">
                <input type="checkbox" checked={form.timeUnknown} onChange={(e) => setForm({ ...form, timeUnknown: e.target.checked, start: "", end: "" })} />
                Time not published, show &quot;(time TBD)&quot; instead of guessing
              </label>
              <label className="editlabel">Source URL
                <input className="edit-input" type="url" value={form.sourceUrl} onChange={(e) => setForm({ ...form, sourceUrl: e.target.value })} />
              </label>
              <div>
                <span className="editlabel" style={{ marginBottom: 6 }}>Tags (leave all off to auto-tag from category)</span>
                <div className="tagtoggles" role="group" aria-label="Occasion tags">
                  {OCCASION_TAGS.map((t) => (
                    <button key={t} type="button" className="tagtoggle" aria-pressed={form.occasionTags.includes(t)}
                      onClick={() => toggleTag(t)}>
                      {t.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
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
