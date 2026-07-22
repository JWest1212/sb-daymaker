"use client";

import { useCallback, useRef, useState } from "react";
import type { EditionSummary, EditionDraftDetail, CockpitPick } from "@/lib/edition/cockpitTypes";
import type { EditionSlot } from "@/lib/edition/types";
import { PickEditor, type PickEditorHandle } from "./PickEditor";
import { SwapPicker } from "./SwapPicker";
import { ArchiveTable } from "./ArchiveTable";
import type { ArchiveRow } from "@/lib/edition/cockpitTypes";
import { Confirm } from "../../ui/Sheet";

const SLOT_TITLE: Record<EditionSlot, string> = {
  hero: "Hero, The Move", secondary: "Secondary", nonevent: "Non-event", anchor: "Anchor, Always worth it",
};
// S6/D4, the short slot names the save bar names dirty picks by.
const SHORT_SLOT_LABEL: Record<EditionSlot, string> = {
  hero: "Hero", secondary: "Secondary", nonevent: "Non-event", anchor: "Anchor",
};

// 'skipped' is the DB value (unchanged, avoids a migration) but reads as
// permanent/terminal, it isn't. It stays fully editable and reversible; the
// one real effect is that it stops the send (see send.ts). Display label
// only; never compare against this anywhere.
const STATUS_LABEL: Record<string, string> = { draft: "Draft", approved: "Approved", skipped: "On hold" };
function statusLabel(status: string): string { return STATUS_LABEL[status] ?? status; }

function bySlot(picks: CockpitPick[], slot: EditionSlot) {
  return picks.filter((p) => p.slot === slot).sort((a, b) => a.position - b.position);
}

function Panel({
  title, subtitle, narrow, children,
}: {
  title: string;
  subtitle?: string;
  narrow?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="ed-panel">
      <div className="ed-panel-head">
        <span className="ed-panel-title">{title}</span>
        {subtitle ? <span className="ed-panel-subtitle">{subtitle}</span> : null}
      </div>
      <div className={`ed-panel-body${narrow ? " ed-panel-body-narrow" : ""}`}>{children}</div>
    </div>
  );
}

export function EditionDraftView({
  pending, initialDetail,
}: {
  pending: EditionSummary[];
  initialDetail: EditionDraftDetail | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(initialDetail?.id ?? pending[0]?.id ?? null);
  const [detail, setDetail] = useState<EditionDraftDetail | null>(initialDetail);
  const [tab, setTab] = useState<"reviewer" | "archive">("reviewer");
  const [archive, setArchive] = useState<ArchiveRow[] | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [swap, setSwap] = useState<{ slot: EditionSlot; position: number } | null>(null);
  const [chrome, setChrome] = useState({
    subject: initialDetail?.subject ?? "", preheader: initialDetail?.preheader ?? "", greeting: initialDetail?.greeting ?? "",
  });
  const [savingPick, setSavingPick] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  // Bumped to force the preview iframe to reload after a save (its own GET is
  // otherwise indistinguishable from the prior render to the browser cache).
  const [previewNonce, setPreviewNonce] = useState(0);

  // S6/D4, dirty state lifted from each PickEditor (which still owns its own
  // field values) so the view can render one save bar naming everything
  // unsaved. pickRefs lets "Save all" trigger a specific pick's own save
  // without lifting its fields up too. discardNonce forces every PickEditor
  // to remount (re-seeding from the still-pristine `detail.picks`) on Discard all.
  const [dirtyPicks, setDirtyPicks] = useState<Record<string, boolean>>({});
  const [discardNonce, setDiscardNonce] = useState(0);
  const pickRefs = useRef(new Map<string, PickEditorHandle>());
  const onDirtyChange = useCallback((pickId: string, dirty: boolean) => {
    setDirtyPicks((d) => (d[pickId] === dirty ? d : { ...d, [pickId]: dirty }));
  }, []);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); }, []);

  const loadDetail = useCallback(async (id: string) => {
    const res = await fetch(`/api/admin/editions/${id}`).then((r) => r.json()).catch(() => null);
    if (res?.edition) {
      setDetail(res.edition);
      setChrome({ subject: res.edition.subject ?? "", preheader: res.edition.preheader ?? "", greeting: res.edition.greeting ?? "" });
      setPreviewNonce((n) => n + 1);
    }
  }, []);

  const selectEdition = useCallback(async (id: string) => {
    setSelectedId(id);
    await loadDetail(id);
  }, [loadDetail]);

  const loadArchive = useCallback(async () => {
    const res = await fetch("/api/admin/editions/archive").then((r) => r.json()).catch(() => null);
    setArchive(res?.editions ?? []);
  }, []);

  const switchTab = (t: "reviewer" | "archive") => {
    setTab(t);
    if (t === "archive" && archive === null) loadArchive();
  };

  const saveChrome = async (opts?: { silent?: boolean }): Promise<boolean> => {
    if (!detail) return false;
    const res = await fetch(`/api/admin/editions/${detail.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(chrome),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      if (!opts?.silent) { showToast("Saved"); loadDetail(detail.id); }
      return true;
    }
    if (!opts?.silent) showToast(res?.error ?? "Save failed");
    return false;
  };

  const savePick = async (
    pickId: string,
    fields: { title: string; blurb: string; when: string; neighborhood: string; localNote: string },
    opts?: { silent?: boolean },
  ): Promise<boolean> => {
    if (!detail) return false;
    setSavingPick(pickId);
    const res = await fetch(`/api/admin/editions/${detail.id}/picks/${pickId}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({
        override_title: fields.title, override_blurb: fields.blurb || null, override_when: fields.when || null,
        override_neighborhood: fields.neighborhood || null, override_local_note: fields.localNote || null,
      }),
    }).then((r) => r.json()).catch(() => null);
    setSavingPick(null);
    if (res?.ok) {
      if (!opts?.silent) { showToast("Pick saved"); loadDetail(detail.id); }
      return true;
    }
    if (!opts?.silent) showToast(res?.error ?? "Save failed");
    return false;
  };

  const chromeDirty = !!detail && (
    chrome.subject !== (detail.subject ?? "")
    || chrome.preheader !== (detail.preheader ?? "")
    || chrome.greeting !== (detail.greeting ?? "")
  );

  const saveAllChanges = async () => {
    if (!detail) return;
    let allOk = true;
    for (const [pickId, dirty] of Object.entries(dirtyPicks)) {
      if (!dirty) continue;
      const handle = pickRefs.current.get(pickId);
      if (!handle) continue;
      const ok = await handle.save();
      if (!ok) allOk = false;
    }
    if (chromeDirty) {
      const ok = await saveChrome({ silent: true });
      if (!ok) allOk = false;
    }
    await loadDetail(detail.id);
    showToast(allOk ? "Saved all changes" : "Some changes failed to save, check the picks above");
  };

  const [confirmingDiscard, setConfirmingDiscard] = useState(false);

  const discardAllChanges = () => {
    if (!detail) return;
    setConfirmingDiscard(true);
  };

  const confirmDiscardAllChanges = () => {
    if (!detail) return;
    setChrome({ subject: detail.subject ?? "", preheader: detail.preheader ?? "", greeting: detail.greeting ?? "" });
    setDirtyPicks({});
    setDiscardNonce((n) => n + 1);
    setConfirmingDiscard(false);
    showToast("Discarded unsaved changes");
  };

  const onImageSaved = () => { if (detail) { showToast("Image updated"); loadDetail(detail.id); } };

  const doSwap = async (thingId: string) => {
    if (!detail || !swap) return;
    const res = await fetch(`/api/admin/editions/${detail.id}/swap`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ slot: swap.slot, position: swap.position, thingId }),
    }).then((r) => r.json()).catch(() => null);
    setSwap(null);
    if (res?.ok) { showToast("Swapped"); loadDetail(detail.id); } else showToast(res?.error ?? "Swap failed");
  };

  const moveSecondary = async (pickId: string, direction: "up" | "down") => {
    if (!detail) return;
    const secondaries = bySlot(detail.picks, "secondary");
    const idx = secondaries.findIndex((p) => p.id === pickId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (idx < 0 || swapIdx < 0 || swapIdx >= secondaries.length) return;
    const a = secondaries[idx];
    const b = secondaries[swapIdx];
    const patch = (id: string, position: number) =>
      fetch(`/api/admin/editions/${detail.id}/picks/${id}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ position }),
      });
    const [ra, rb] = await Promise.all([patch(a.id, b.position), patch(b.id, a.position)]);
    if (ra.ok && rb.ok) { showToast("Reordered"); loadDetail(detail.id); } else showToast("Reorder failed");
  };

  // Neither approving nor holding removes the edition from view or blocks
  // further edits (only Hold blocks the SEND, handled server-side in
  // send.ts), so this always just refreshes the current detail in place.
  // (Holding used to navigate away to "whatever's next," back when 'skipped'
  // fell out of the pending list, it no longer does, so there's nothing to
  // navigate to.)
  const setStatus = async (status: "approved" | "skipped" | "draft", skip_reason?: string) => {
    if (!detail) return;
    const res = await fetch(`/api/admin/editions/${detail.id}`, {
      method: "PATCH", headers: { "content-type": "application/json" },
      body: JSON.stringify({ status, ...(skip_reason ? { skip_reason } : {}) }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      // Approving an edition whose send window already passed (e.g. it was on
      // hold past its scheduled time) triggers an immediate send server-side, // res.sent is only present when that happened.
      if (res.sent) {
        showToast(res.sent.ok ? `Approved, sent to ${res.sent.sent} reader${res.sent.sent === 1 ? "" : "s"} just now` : `Approved, but the send failed: ${res.sent.skipReason ?? "unknown error"}`);
      } else {
        showToast(status === "approved" ? "Approved" : status === "skipped" ? "On hold" : "Reset to draft");
      }
      loadDetail(detail.id);
    } else showToast(res?.error ?? "Update failed");
  };

  if (!detail) {
    return (
      <div className="wrap" style={{ display: "block", maxWidth: 1180 }}>
        <div className="vhead"><h1 className="qtitle">Edition draft</h1></div>
        <div className="gatebox">No edition to review right now. The drafter runs Wednesday and Saturday mornings (06:00 PT), a full day before each send. Already-sent or failed editions are in the Archive tab.</div>
      </div>
    );
  }

  const hero = bySlot(detail.picks, "hero")[0];
  const secondaries = bySlot(detail.picks, "secondary");
  const nonEvent = bySlot(detail.picks, "nonevent")[0];
  const anchor = bySlot(detail.picks, "anchor")[0];

  // S6/D4, the save bar's "what's unsaved" list, by short slot name.
  const allPicks = [hero, ...secondaries, nonEvent, anchor].filter((p): p is CockpitPick => !!p);
  const dirtyPickLabels = allPicks
    .filter((p) => dirtyPicks[p.id])
    .map((p) => (p.slot === "secondary" ? `Secondary ${secondaries.findIndex((s) => s.id === p.id) + 1}` : SHORT_SLOT_LABEL[p.slot]));
  const dirtyLabels = chromeDirty ? ["Chrome", ...dirtyPickLabels] : dirtyPickLabels;
  const anyDirty = dirtyLabels.length > 0;

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 1180 }}>
      <div className="vhead">
        <h1 className="qtitle">
          Edition draft
          <span className="count"> {detail.edition_date} · {detail.edition_type === "weekend" ? "Thu weekend" : "Sun week-ahead"}</span>
        </h1>
        <span className="spacer" />
        {pending.length > 1 ? (
          <select value={selectedId ?? ""} onChange={(e) => selectEdition(e.target.value)} className="ed-select">
            {pending.map((p) => <option key={p.id} value={p.id}>{p.edition_date} ({statusLabel(p.status)})</option>)}
          </select>
        ) : null}
      </div>

      <div className="filterbar" role="tablist">
        <button className="filt" aria-pressed={tab === "reviewer"} onClick={() => switchTab("reviewer")}>Draft reviewer</button>
        <button className="filt" aria-pressed={tab === "archive"} onClick={() => switchTab("archive")}>Archive</button>
      </div>

      {tab === "archive" ? (
        <ArchiveTable rows={archive} />
      ) : (
        <>
          <Panel title="Draft preview" subtitle="as it will render in the email">
            <div className="ed-preview-full">
              <iframe
                src={`/api/admin/editions/${detail.id}/preview?v=${previewNonce}`}
                title="Edition preview" className="ed-preview-frame"
              />
            </div>
          </Panel>

          <Panel title="Draft editor" subtitle={`status: ${statusLabel(detail.status)}`} narrow>
            <div className="card" style={{ padding: 16 }}>
              <div className="ed-pick-head"><span className="ed-pick-thing">Chrome</span><span className={`chip ${detail.status === "approved" ? "green" : "amber"}`}><span className="dot" />{statusLabel(detail.status)}</span></div>
              <label className="ed-field"><span>Subject</span>
                <input value={chrome.subject} onChange={(e) => setChrome((c) => ({ ...c, subject: e.target.value }))} /></label>
              <label className="ed-field"><span>Preheader</span>
                <input value={chrome.preheader} onChange={(e) => setChrome((c) => ({ ...c, preheader: e.target.value }))} /></label>
              <label className="ed-field"><span>Greeting</span>
                <input value={chrome.greeting} onChange={(e) => setChrome((c) => ({ ...c, greeting: e.target.value }))} /></label>
              <div className="ed-pick-actions">
                <button className="btn btn-approve btn-sm" onClick={() => saveChrome()}>Save chrome</button>
              </div>
            </div>

            {hero ? (
              <div className="card" style={{ padding: 16 }}>
                <p className="ed-slot-title">{SLOT_TITLE.hero}</p>
                <PickEditor key={`${hero.id}-${hero.thingId}-${discardNonce}`} ref={(el) => { if (el) pickRefs.current.set(hero.id, el); else pickRefs.current.delete(hero.id); }} pick={hero} editionId={detail.id} onSave={savePick} onImageSaved={onImageSaved} onMoreImagesFound={() => detail && loadDetail(detail.id)} onDirtyChange={onDirtyChange}
                  saving={savingPick === hero.id} onSwap={() => setSwap({ slot: "hero", position: 0 })} />
              </div>
            ) : null}

            {secondaries.length ? (
              <div className="card" style={{ padding: 16 }}>
                <p className="ed-slot-title">Secondaries <em>use ▲▼ to reorder</em></p>
                {secondaries.map((p, i) => (
                  <PickEditor
                    key={`${p.id}-${p.thingId}-${discardNonce}`} ref={(el) => { if (el) pickRefs.current.set(p.id, el); else pickRefs.current.delete(p.id); }} pick={p} editionId={detail.id} onSave={savePick} onImageSaved={onImageSaved} onMoreImagesFound={() => detail && loadDetail(detail.id)} onDirtyChange={onDirtyChange}
                    saving={savingPick === p.id} onSwap={() => setSwap({ slot: "secondary", position: p.position })}
                    reorder={{
                      canMoveUp: i > 0, canMoveDown: i < secondaries.length - 1,
                      onMoveUp: () => moveSecondary(p.id, "up"), onMoveDown: () => moveSecondary(p.id, "down"),
                    }}
                  />
                ))}
              </div>
            ) : null}

            {nonEvent ? (
              <div className="card" style={{ padding: 16 }}>
                <p className="ed-slot-title">{SLOT_TITLE.nonevent}</p>
                <PickEditor key={`${nonEvent.id}-${nonEvent.thingId}-${discardNonce}`} ref={(el) => { if (el) pickRefs.current.set(nonEvent.id, el); else pickRefs.current.delete(nonEvent.id); }} pick={nonEvent} editionId={detail.id} onSave={savePick} onImageSaved={onImageSaved} onMoreImagesFound={() => detail && loadDetail(detail.id)} onDirtyChange={onDirtyChange}
                  saving={savingPick === nonEvent.id} onSwap={() => setSwap({ slot: "nonevent", position: 0 })} />
              </div>
            ) : null}

            {anchor ? (
              <div className="card" style={{ padding: 16 }}>
                <p className="ed-slot-title">{SLOT_TITLE.anchor}</p>
                <PickEditor key={`${anchor.id}-${anchor.thingId}-${discardNonce}`} ref={(el) => { if (el) pickRefs.current.set(anchor.id, el); else pickRefs.current.delete(anchor.id); }} pick={anchor} editionId={detail.id} onSave={savePick} onImageSaved={onImageSaved} onMoreImagesFound={() => detail && loadDetail(detail.id)} onDirtyChange={onDirtyChange}
                  saving={savingPick === anchor.id} onSwap={() => setSwap({ slot: "anchor", position: 0 })} />
              </div>
            ) : null}

            <div className="card" style={{ padding: 16 }}>
              <p className="ed-slot-title">Decision</p>
              <div className="ed-pick-actions" style={{ justifyContent: "flex-start", gap: 10 }}>
                <button className="btn btn-approve btn-sm" onClick={() => setStatus("approved")} disabled={detail.status === "approved"}>
                  {detail.status === "approved" ? "Approved ✓" : "Approve"}
                </button>
                <input
                  className="ed-search" placeholder="Note (optional)" value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)} style={{ maxWidth: 220 }}
                />
                <button className="btn btn-quiet btn-sm" onClick={() => setStatus("skipped", rejectReason || "on hold")} disabled={detail.status === "skipped"}>
                  {detail.status === "skipped" ? "On hold ✓" : "Hold"}
                </button>
                {detail.status !== "draft" ? (
                  <button className="btn btn-quiet btn-sm" onClick={() => setStatus("draft")}>
                    Reset to draft
                  </button>
                ) : null}
              </div>
              <p className="ed-hint">
                This edition sends automatically at its normal time (07:00 PT on send day) whether or not you approve it, approving is just a note to yourself. <strong>Hold is the one thing that stops it</strong>: click it and this edition will NOT send until you take it off hold. It stays fully editable either way. If its normal send time has already passed (e.g. it was on hold), clicking Approve sends it right away instead of waiting for the next scheduled window.
                {detail.status !== "draft" ? " Reset to draft clears your Approve/Hold decision and lets the automatic drafter safely regenerate this edition's picks the next time it runs." : null}
              </p>
            </div>
          </Panel>

          {anyDirty ? (
            <div className="ed-savebar" role="status">
              <span className="ed-savebar-who">
                <b>{dirtyLabels.length} {dirtyLabels.length === 1 ? "pick has" : "picks have"} unsaved changes</b>: {dirtyLabels.join(", ")}
              </span>
              <span className="spacer" />
              <button type="button" className="ed-discard" onClick={discardAllChanges}>Discard all</button>
              <button type="button" className="ed-saveall" onClick={saveAllChanges}>Save all changes</button>
            </div>
          ) : null}
        </>
      )}

      {swap ? (
        <SwapPicker
          slot={swap.slot} position={swap.position} editionId={detail.id}
          candidates={detail.candidates.filter((c) => c.slot === swap.slot)}
          onClose={() => setSwap(null)} onPick={doSwap}
        />
      ) : null}

      <Confirm
        open={confirmingDiscard}
        title="Discard all unsaved changes?"
        body="Every dirty pick and any chrome edit in this pass is discarded. Anything already saved is unaffected."
        confirmLabel="Discard all"
        danger
        onConfirm={confirmDiscardAllChanges}
        onCancel={() => setConfirmingDiscard(false)}
      />

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
