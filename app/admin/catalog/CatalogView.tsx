"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { NEIGHBORHOODS, OCCASION_TAGS, type CatalogRow, type PhotoOption } from "@/lib/review";
import { OCCASIONS, OCCASION_BY_KEY } from "@/lib/occasions";
import { ZONES, ZONE_LABEL } from "@/lib/zones";
import { useFocusTrap } from "@/lib/useFocusTrap";
import { WeightNudge } from "../WeightNudge";
import { CatalogImagePicker, type AppliedPhoto } from "./CatalogImagePicker";

interface CatalogResult { rows: CatalogRow[]; total: number; page: number; pageSize: number; }
type Tier = "all" | "1" | "2" | "3";
interface Draft { title: string; blurb: string; blurb_long: string; neighborhood: string; tags: string[]; }
interface Toast { msg: string; undo?: () => void; }

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
  const [fetchError, setFetchError] = useState(false);
  const [heroOverride, setHeroOverride] = useState<Record<string, boolean>>({});
  const [editing, setEditing] = useState<CatalogRow | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const pageSize = initial.pageSize;
  const sheetRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(sheetRef, !!editing);

  const showToast = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    setTimeout(() => setToast(null), 3600);
  }, []);
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
    try {
      const r = await fetch(`/api/admin/catalog?${sp}`);
      if (!r.ok) throw new Error(`status ${r.status}`);
      const res: CatalogResult = await r.json();
      setRows(res.rows); setTotal(res.total); setPage(res.page);
      setFetchError(false);
    } catch {
      // LC-2: a failed refresh keeps showing the last-known rows — don't wipe
      // them — but the banner below makes clear they're stale, not empty.
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }, [tier, vibe, zone, qDebounced]);

  // Refetch from page 1 whenever a filter changes.
  useEffect(() => { fetchPage(1); }, [tier, vibe, zone, qDebounced, fetchPage]);

  const toggleHero = useCallback(async (r: CatalogRow) => {
    const next = !isHero(r);
    setHeroOverride((h) => ({ ...h, [r.id]: next })); // optimistic
    const res = await fetch("/api/admin/hero-eligible", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ thing_id: r.id, hero_eligible: next }),
    }).then((res) => res.json()).catch(() => null);
    if (!res?.ok) {
      setHeroOverride((h) => ({ ...h, [r.id]: !next })); // revert
      showToast("Hero toggle failed — reverted");
    } else {
      showToast(next ? `★ Hero-flagged ${r.title}` : "Removed hero flag");
    }
  }, [heroOverride, showToast]);

  const openEdit = useCallback((r: CatalogRow) => {
    setEditing(r);
    setDraft({ title: r.title, blurb: r.blurb ?? "", blurb_long: r.blurb_long ?? "", neighborhood: r.neighborhood ?? "", tags: [...r.tags] });
  }, []);

  const toggleDraftTag = (tag: string) =>
    setDraft((d) => d ? { ...d, tags: d.tags.includes(tag) ? d.tags.filter((t) => t !== tag) : [...d.tags, tag] } : d);

  // Photo picks apply instantly (their own network call inside CatalogImagePicker) —
  // this just syncs the already-applied result into the row list + the open sheet,
  // so the thumbnail behind the sheet and the sheet's own "currently live" state
  // both reflect it without a page reload.
  const applyPhoto = useCallback((thingId: string, photo: AppliedPhoto) => {
    setRows((rs) => rs.map((r) => (r.id === thingId
      ? { ...r, photo_url: photo.url, photo_source: photo.source, photo_attribution: photo.attribution }
      : r)));
    setEditing((e) => (e && e.id === thingId
      ? { ...e, photo_url: photo.url, photo_source: photo.source, photo_attribution: photo.attribution }
      : e));
  }, []);

  // 2026-07-10 addendum: a fetch can auto-attach/auto-create a venue for a thing
  // that didn't have one — sync venue_id so a second fetch in the same sheet
  // session reuses it instead of re-running the attach/create logic.
  const applyVenueId = useCallback((thingId: string, venueId: string) => {
    setRows((rs) => rs.map((r) => (r.id === thingId ? { ...r, venue_id: venueId } : r)));
    setEditing((e) => (e && e.id === thingId ? { ...e, venue_id: venueId } : e));
  }, []);

  // LC-9: sync a fresh fetch's candidates into row + sheet state so closing and
  // reopening the edit sheet doesn't discard them — otherwise CatalogImagePicker
  // remounts from editing.photo_options (only ever-applied picks), losing any
  // fetched-but-not-yet-applied candidates from this session.
  const applyOptions = useCallback((thingId: string, options: PhotoOption[]) => {
    setRows((rs) => rs.map((r) => (r.id === thingId ? { ...r, photo_options: options } : r)));
    setEditing((e) => (e && e.id === thingId ? { ...e, photo_options: options } : e));
  }, []);

  // Admin edits apply directly to the live row — no review queue.
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
      setRows((rs) => rs.map((r) => (r.id === editing.id ? {
        ...r,
        title: draft.title.trim() || r.title,
        blurb: draft.blurb || null, blurb_long: draft.blurb_long || null,
        neighborhood: draft.neighborhood || null, tags: draft.tags,
      } : r)));
      setEditing(null); setDraft(null);
      showToast("Saved — live on the site now.");
    } else {
      showToast(res?.error ?? "Edit failed");
    }
  }, [editing, draft, showToast]);

  // Delete = unpublish/archive (reversible). Removes from the live site immediately.
  const del = useCallback((r: CatalogRow) => {
    if (!window.confirm(`Remove "${r.title}" from the live site?\n\nIt will be unpublished (reversible), not permanently deleted.`)) return;
    fetch("/api/admin/catalog/delete", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thing_id: r.id }),
    }).then((res) => res.json()).then((res) => {
      if (res?.ok) { setRows((rs) => rs.filter((x) => x.id !== r.id)); setTotal((t) => Math.max(0, t - 1)); showToast(`Removed "${r.title}" from the site`); }
      else showToast(res?.error ?? "Delete failed");
    }).catch(() => showToast("Delete failed"));
  }, [showToast]);

  // LC-10 — queues a directive for tonight's worker; fires no Claude call now.
  // The fresh draft lands as a pending edit in the Queue for a normal approve.
  const doRedraft = useCallback(async (thingId: string) => {
    const res = await fetch("/api/admin/catalog/redraft", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ thing_id: thingId }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      showToast(
        res.queued
          ? "Queued for tonight's redraft — no AI call now. It'll land in the Queue for review."
          : "Already queued for tonight's redraft.",
      );
    } else {
      showToast(res?.error ?? "Couldn't queue a redraft");
    }
  }, [showToast]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 1180 }}>
      <div className="vhead">
        <h1 className="qtitle">Live catalog<span className="count"> </span></h1>
        <span className="spacer" />
        <span className="lcount">{loading ? "…" : `${rows.length} of ${total} live`}</span>
      </div>
      <p className="vsub">Everything currently published. Edits here go live immediately, no review step. To change a start time, reject and re-ingest in the Queue.</p>

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

      {fetchError ? (
        <div className="covempty is-error">
          Couldn&apos;t refresh the list. Showing the last results.
          <button className="btn btn-edit btn-sm" onClick={() => fetchPage(page)}>Retry</button>
        </div>
      ) : null}

      {rows.length === 0 && !fetchError ? (
        <div className="covempty">{loading ? "Loading…" : "No published things match these filters."}</div>
      ) : rows.length === 0 ? null : (() => {
        let prevGroup = "";
        return rows.map((r) => {
          const showHeader = r.groupKey !== prevGroup;
          prevGroup = r.groupKey;
          return (
        <Fragment key={r.id}>
          {showHeader ? <div className="lgroup">{r.groupLabel}</div> : null}
        <div className={`lrow${r.pending_edit ? " pending" : ""}`}>
          {r.photo_url ? <img className="lthumb" src={r.photo_url} alt="" /> : <div className="lthumb" />}
          <div className="lmain">
            <div className="lt">
              <span className="ttl">{r.title}</span>
              <span className={`tier t${r.happening_tier}`}>{TIER_CHIP[r.happening_tier]}</span>
              {r.pending_edit ? <span className="pendpill">Pending edit in Queue</span> : null}
            </div>
            <div className="lmeta">
              <span className="mono">{r.when}</span>
              {r.nearby_zone ? <><span className="dot">·</span><span>{ZONE_LABEL[r.nearby_zone as keyof typeof ZONE_LABEL] ?? r.nearby_zone}</span></> : null}
              {r.tags.length ? <><span className="dot">·</span><span>{r.tags.map((t) => OCCASION_BY_KEY[t as keyof typeof OCCASION_BY_KEY]?.label ?? t).join(", ")}</span></> : null}
              <span className="dot">·</span><span className="mono">{r.price_band == null ? "—" : r.price_band}</span>
            </div>
          </div>
          <div className="lacts">
            <WeightNudge thingId={r.id} title={r.title} weight={r.editorial_weight} onToast={showToast} />
            <button className={`herostar${isHero(r) ? " is-on" : ""}`} aria-pressed={isHero(r)} onClick={() => toggleHero(r)} title="Toggle hero eligibility">
              <span className="st">{isHero(r) ? "★" : "☆"}</span> Hero
            </button>
            <button className="btn btn-edit btn-sm" onClick={() => openEdit(r)} title="Edit — applies to the live site">
              Edit
            </button>
            <button className="btn btn-reject btn-sm" onClick={() => del(r)} aria-label={`Delete ${r.title}`} title="Remove from the live site (unpublish)">
              Delete
            </button>
          </div>
        </div>
        </Fragment>
          );
        });
      })()}

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
          <div className="sheet show" role="dialog" aria-modal="true" aria-labelledby="ceTitle" ref={sheetRef}>
            <h3 id="ceTitle">Edit live thing<button className="x" aria-label="Close" onClick={() => { setEditing(null); setDraft(null); }}>✕</button></h3>
            <div className="sbody">
              <CatalogImagePicker
                thingId={editing.id}
                photoUrl={editing.photo_url}
                photoSource={editing.photo_source}
                photoAttribution={editing.photo_attribution}
                options={editing.photo_options}
                venueId={editing.venue_id}
                placeId={editing.place_id}
                lat={editing.lat}
                lng={editing.lng}
                onApplied={(photo) => applyPhoto(editing.id, photo)}
                onVenueAttached={(venueId) => applyVenueId(editing.id, venueId)}
                onOptionsFetched={(options) => applyOptions(editing.id, options)}
                onToast={showToast}
              />
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
              <div className="gatebox">Changes apply to the live site immediately — no review step. (Start time isn&apos;t editable here; to change one, reject &amp; re-ingest in the Queue.)</div>
            </div>
            <div className="sfoot">
              <button
                className="btn btn-quiet"
                style={{ marginRight: "auto" }}
                onClick={() => doRedraft(editing.id)}
                title="Queues a fresh AI blurb/tags draft for tonight's worker — no AI call now"
              >
                Redraft blurb + tags tonight
              </button>
              <button className="btn btn-edit" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button>
              <button className="btn btn-approve" onClick={submitEdit}>Save changes</button>
            </div>
          </div>
        </>
      ) : null}

      {toast ? (
        <div className="toast show" role="status">
          {toast.msg}
          {toast.undo ? <span className="undo" onClick={toast.undo} role="button" tabIndex={0}>Undo</span> : null}
        </div>
      ) : null}
    </div>
  );
}
