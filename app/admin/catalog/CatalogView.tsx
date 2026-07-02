"use client";

import { useCallback, useEffect, useState } from "react";
import { NEIGHBORHOODS, OCCASION_TAGS, type CatalogRow } from "@/lib/review";
import { OCCASIONS, OCCASION_BY_KEY } from "@/lib/occasions";
import { ZONES, ZONE_LABEL } from "@/lib/zones";

interface CatalogResult { rows: CatalogRow[]; total: number; page: number; pageSize: number; }
type Tier = "all" | "1" | "2" | "3";
interface Draft { title: string; blurb: string; blurb_long: string; neighborhood: string; tags: string[]; }

const TIER_CHIP: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };

export function CatalogView({ initial }: { initial: CatalogResult }) {
  const [rows, setRows] = useState<CatalogRow[]>(initial.rows);
  const [total, setTotal] = useState(initial.total);
  const [page, setPage] = useState(initial.page);
  const [tier, setTier] = useState<Tier>("all");
  const [vibe, setVibe] = useState("");
  const [zone, setZone] = useState("");
  const [q, setQ] = useState("");
  const [qDebounced, setQDebounced] = useState("");
  const [loading, setLoading] = useState(false);
  const [heroOverride, setHeroOverride] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const pageSize = initial.pageSize;

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3600); }, []);
  const isHero = (r: CatalogRow) => heroOverride[r.id] ?? r.hero_eligible;

  useEffect(() => { const t = setTimeout(() => setQDebounced(q), 350); return () => clearTimeout(t); }, [q]);

  // Esc closes the edit sheet (keyboard operability).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && editing) { setEditing(null); setDraft(null); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editing]);

  const fetchPage = useCallback(async (p: number) => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (tier !== "all") sp.set("tier", tier);
    if (vibe) sp.set("vibe", vibe);
    if (zone) sp.set("zone", zone);
    if (qDebounced) sp.set("q", qDebounced);
    sp.set("page", String(p));
    const res: CatalogResult | null = await fetch(`/api/admin/catalog?${sp}`).then((r) => r.json()).catch(() => null);
    setLoading(false);
    if (res) { setRows(res.rows); setTotal(res.total); setPage(res.page); }
  }, [tier, vibe, zone, qDebounced]);

  // Refetch from page 1 whenever a filter changes.
  useEffect(() => { fetchPage(1); }, [tier, vibe, zone, qDebounced, fetchPage]);

  const toggleHero = useCallback((r: CatalogRow) => {
    const next = !isHero(r);
    setHeroOverride((h) => ({ ...h, [r.id]: next }));
    fetch("/api/admin/hero-eligible", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ thing_id: r.id, hero_eligible: next }),
    });
    showToast(next ? `★ Hero-flagged ${r.title}` : "Removed hero flag");
  }, [heroOverride, showToast]);

  const openEdit = useCallback((r: CatalogRow) => {
    setEditing(r);
    setDraft({ title: r.title, blurb: r.blurb ?? "", blurb_long: r.blurb_long ?? "", neighborhood: r.neighborhood ?? "", tags: [...r.tags] });
  }, []);

  const toggleDraftTag = (tag: string) =>
    setDraft((d) => d ? { ...d, tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag] } : d);

  const submitEdit = useCallback(async () => {
    if (!editing || !draft) return;
    const payload = {
      title: draft.title, blurb: draft.blurb || null, blurb_long: draft.blurb_long || null,
      neighborhood: draft.neighborhood || null, tags: draft.tags,
    };
    const res = await fetch("/api/admin/catalog/edit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ thing_id: editing.id, payload }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      setRows((rs) => rs.map((r) => (r.id === editing.id ? { ...r, pending_edit: true } : r)));
      setEditing(null); setDraft(null);
      showToast("Edit queued — it's at the top of the Queue. The live version stays up until you re-approve it.");
    } else {
      showToast(res?.error ?? "Edit failed");
    }
  }, [editing, draft, showToast]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 1180 }}>
      <div className="vhead">
        <h1 className="qtitle">Live catalog<span className="count"> </span></h1>
        <span className="spacer" />
        <span className="lcount">{loading ? "…" : `${rows.length} of ${total} live`}</span>
      </div>
      <p className="vsub">Everything currently published. Edits go back through the Queue; the live version stays up until you re-approve.</p>

      <div className="filters">
        <div className="filterbar" role="group" aria-label="Filter by tier">
          {(["all", "1", "2", "3"] as Tier[]).map((t) => (
            <button key={t} className="filt" aria-pressed={tier === t} onClick={() => setTier(t)}>
              {t === "all" ? "All" : t === "1" ? "Tier 1" : t === "2" ? "Tier 2" : "Tier 3"}
            </button>
          ))}
        </div>
        <select className="fsel" value={vibe} onChange={(e) => setVibe(e.target.value)} aria-label="Filter by vibe">
          <option value="">All vibes</option>
          {OCCASIONS.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
        </select>
        <select className="fsel" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Filter by zone">
          <option value="">All zones</option>
          {ZONES.map((z) => <option key={z.zone} value={z.zone}>{z.label}</option>)}
        </select>
        <div className="search"><span aria-hidden="true">⌕</span>
          <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search titles…" aria-label="Search live things" />
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="covempty">{loading ? "Loading…" : "No published things match these filters."}</div>
      ) : rows.map((r) => (
        <div className={`lrow${r.pending_edit ? " pending" : ""}`} key={r.id}>
          {r.photo_url ? <img className="lthumb" src={r.photo_url} alt="" /> : <div className="lthumb" />}
          <div className="lmain">
            <div className="lt">
              <span className="ttl">{r.title}</span>
              <span className={`tier t${r.happening_tier}`}>{TIER_CHIP[r.happening_tier]}</span>
              {r.pending_edit ? <span className="pendpill">edit pending review</span> : null}
            </div>
            <div className="lmeta">
              <span className="mono">{r.when}</span>
              {r.nearby_zone ? <><span className="dot">·</span><span>{ZONE_LABEL[r.nearby_zone as keyof typeof ZONE_LABEL] ?? r.nearby_zone}</span></> : null}
              {r.tags.length ? <><span className="dot">·</span><span>{r.tags.map((t) => OCCASION_BY_KEY[t as keyof typeof OCCASION_BY_KEY]?.label ?? t).join(", ")}</span></> : null}
              <span className="dot">·</span><span className="mono">{r.price_band == null ? "—" : r.price_band}</span>
            </div>
          </div>
          <div className="lacts">
            <button className={`herostar${isHero(r) ? " is-on" : ""}`} aria-pressed={isHero(r)} onClick={() => toggleHero(r)} title="Toggle hero eligibility">
              <span className="st">{isHero(r) ? "★" : "☆"}</span> Hero
            </button>
            <button className="btn btn-edit btn-sm" disabled={r.pending_edit} onClick={() => openEdit(r)}
              title={r.pending_edit ? "An edit is already awaiting review" : "Edit"}>
              Edit
            </button>
          </div>
        </div>
      ))}

      {totalPages > 1 ? (
        <div className="pager">
          <button disabled={page <= 1 || loading} onClick={() => fetchPage(page - 1)}>← Prev</button>
          <span>Page {page} of {totalPages}</span>
          <button disabled={page >= totalPages || loading} onClick={() => fetchPage(page + 1)}>Next →</button>
        </div>
      ) : null}

      {editing && draft ? (
        <>
          <div className="scrim show" onClick={() => { setEditing(null); setDraft(null); }} />
          <div className="sheet show" role="dialog" aria-modal="true" aria-labelledby="ceTitle">
            <h3 id="ceTitle">Edit live thing<button className="x" aria-label="Close" onClick={() => { setEditing(null); setDraft(null); }}>✕</button></h3>
            <div className="sbody">
              <label className="editlabel">Title
                <input className="edit-textarea" value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} />
              </label>
              <label className="editlabel">Blurb
                <textarea className="edit-textarea" rows={2} value={draft.blurb} onChange={(e) => setDraft({ ...draft, blurb: e.target.value })} />
              </label>
              <label className="editlabel">Long blurb
                <textarea className="edit-textarea" rows={3} value={draft.blurb_long} onChange={(e) => setDraft({ ...draft, blurb_long: e.target.value })} />
              </label>
              <label className="editlabel">Neighborhood
                <select className="edit-select" value={draft.neighborhood} onChange={(e) => setDraft({ ...draft, neighborhood: e.target.value })}>
                  <option value="">— none —</option>
                  {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n.replace(/_/g, " ")}</option>)}
                </select>
              </label>
              <div className="tagtoggles" role="group" aria-label="Occasion tags">
                {OCCASION_TAGS.map((t) => {
                  const on = draft.tags.includes(t);
                  const disabled = (t === "family_day" && !!editing.is_21_plus) || (t === "free_sb" && editing.price_band != null && editing.price_band !== "free");
                  return (
                    <button key={t} type="button" className="tagtoggle" aria-pressed={on} disabled={disabled}
                      title={disabled ? "Not allowed for this item" : undefined} onClick={() => toggleDraftTag(t)}>
                      {t.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
              <div className="gatebox">This creates an edit that goes to the top of the review Queue. The live version stays up untouched until you approve it there. (Start time isn&apos;t editable — reject &amp; re-ingest to change one.)</div>
            </div>
            <div className="sfoot">
              <button className="btn btn-edit" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button>
              <button className="btn btn-approve" onClick={submitEdit}>Submit edit for review</button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
