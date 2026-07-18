"use client";

import { useState } from "react";
import type { CockpitPick } from "@/lib/edition/cockpitTypes";
import type { EditionSlot } from "@/lib/edition/types";
import { EditionImageEditor } from "./EditionImageEditor";

const SHOWS_WHEN_LOCATOR: Record<EditionSlot, boolean> = { hero: true, secondary: true, nonevent: false, anchor: false };
const SHOWS_LOCAL_SECRET: Record<EditionSlot, boolean> = { hero: true, secondary: false, nonevent: false, anchor: false };
const SHOWS_IMAGE: Record<EditionSlot, boolean> = { hero: true, secondary: true, nonevent: false, anchor: false };

interface Fields {
  title: string; blurb: string; when: string; neighborhood: string; localNote: string;
}

/** The hero slot's effective blurb is the longer blurb_long (falling back to
 *  the short blurb for an older row missing it), mirrors renderData.ts's
 *  blurbSourceFor exactly, so the editor always shows what will actually
 *  render/send, not a stale/empty field with the title ghosted in behind it. */
function effectiveBlurb(pick: CockpitPick): string {
  if (pick.override_blurb != null) return pick.override_blurb;
  if (pick.slot === "hero") return pick.thing.blurb_long ?? pick.thing.blurb ?? "";
  return pick.thing.blurb ?? "";
}

function fieldsFrom(pick: CockpitPick): Fields {
  return {
    title: pick.override_title ?? pick.thing.title,
    blurb: effectiveBlurb(pick),
    when: pick.override_when ?? pick.thing.when,
    neighborhood: pick.override_neighborhood ?? pick.thing.neighborhood ?? "",
    localNote: pick.override_local_note ?? "",
  };
}

export interface ReorderControls {
  canMoveUp: boolean;
  canMoveDown: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
}

export function PickEditor({
  pick, onSave, onSwap, onImageSaved, onMoreImagesFound, editionId, saving, reorder,
}: {
  pick: CockpitPick;
  onSave: (pickId: string, fields: Fields) => Promise<void>;
  onSwap: () => void;
  onImageSaved: (pickId: string, url: string) => void;
  onMoreImagesFound: () => void;
  editionId: string;
  saving: boolean;
  reorder?: ReorderControls;
}) {
  const [fields, setFields] = useState<Fields>(() => fieldsFrom(pick));
  const [dirty, setDirty] = useState(false);
  const [aiInstruction, setAiInstruction] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFields((f) => ({ ...f, [k]: e.target.value }));
    setDirty(true);
  };

  const aiEdit = async () => {
    if (!aiInstruction.trim() || aiBusy) return;
    setAiBusy(true); setAiError(null);
    const res = await fetch(`/api/admin/editions/${editionId}/picks/${pick.id}/blurb-edit`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ instruction: aiInstruction, currentBlurb: fields.blurb }),
    }).then((r) => r.json()).catch(() => null);
    setAiBusy(false);
    if (res?.ok) {
      setFields((f) => ({ ...f, blurb: res.blurb }));
      setDirty(true);
      setAiInstruction("");
    } else {
      setAiError(res?.error ?? "Claude edit failed");
    }
  };

  return (
    <div className={`ed-pick${pick.is_manual ? " ed-pick-manual" : ""}`}>
      <div className="ed-pick-head">
        {reorder ? (
          <span className="ed-reorder">
            <button
              type="button" className="ed-reorder-btn" aria-label="Move up" disabled={!reorder.canMoveUp}
              onClick={reorder.onMoveUp}
            >▲</button>
            <button
              type="button" className="ed-reorder-btn" aria-label="Move down" disabled={!reorder.canMoveDown}
              onClick={reorder.onMoveDown}
            >▼</button>
          </span>
        ) : null}
        <span className="ed-pick-thing">{pick.thing.title}</span>
        {pick.is_manual ? <span className="chip evergreen">manual</span> : null}
        <span className="spacer" />
        <button className="btn btn-quiet btn-sm" onClick={onSwap} type="button">Swap</button>
      </div>

      {SHOWS_IMAGE[pick.slot] ? (
        <EditionImageEditor
          editionId={editionId}
          pickId={pick.id}
          currentUrl={pick.override_image_url ?? pick.cached_image_url}
          photoOptions={pick.thing.photo_options}
          onSaved={(url) => onImageSaved(pick.id, url)}
          onMoreFound={onMoreImagesFound}
        />
      ) : null}

      <label className="ed-field">
        <span>Title</span>
        <input value={fields.title} onChange={set("title")} />
      </label>
      <label className="ed-field">
        <span>Blurb</span>
        <textarea rows={3} value={fields.blurb} onChange={set("blurb")} placeholder="No blurb yet, write one, or use Claude below" />
      </label>
      <div className="ed-ai-edit">
        <input
          type="text" className="ed-ai-edit-input" placeholder="Describe an edit… e.g. “make it warmer” or “mention it's dog-friendly”"
          value={aiInstruction} onChange={(e) => setAiInstruction(e.target.value)} disabled={aiBusy}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); aiEdit(); } }}
        />
        <button type="button" className="btn btn-quiet btn-sm" disabled={!aiInstruction.trim() || aiBusy} onClick={aiEdit}>
          {aiBusy ? "Asking Claude…" : "Claude edit for me"}
        </button>
      </div>
      {aiError ? <p className="ed-image-error">{aiError}</p> : null}
      {SHOWS_WHEN_LOCATOR[pick.slot] ? (
        <div className="ed-field-row">
          <label className="ed-field">
            <span>When</span>
            <input value={fields.when} onChange={set("when")} />
          </label>
          <label className="ed-field">
            <span>Neighborhood</span>
            <input value={fields.neighborhood} onChange={set("neighborhood")} />
          </label>
        </div>
      ) : null}
      {SHOWS_LOCAL_SECRET[pick.slot] ? (
        <label className="ed-field">
          <span>Local&apos;s secret <em>(shown only if ~40+ characters)</em></span>
          <textarea rows={2} value={fields.localNote} onChange={set("localNote")} />
        </label>
      ) : null}

      <div className="ed-pick-actions">
        <button
          className="btn btn-approve btn-sm"
          disabled={!dirty || saving}
          onClick={async () => { await onSave(pick.id, fields); setDirty(false); }}
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
