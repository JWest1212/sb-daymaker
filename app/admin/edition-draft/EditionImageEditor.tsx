"use client";

import { useState } from "react";
import type { PhotoOption } from "@/lib/review";

const MAX_OPTIONS = 10; // 6 guaranteed at draft time + up to 4 more via "find more"

export function EditionImageEditor({
  editionId, pickId, currentUrl, photoOptions, onSaved, onMoreFound,
}: {
  editionId: string;
  pickId: string;
  currentUrl: string | null;
  photoOptions: PhotoOption[];
  onSaved: (url: string) => void;
  onMoreFound: () => void;
}) {
  const [pasteUrl, setPasteUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [finding, setFinding] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const base = `/api/admin/editions/${editionId}/picks/${pickId}/image`;
  // The drafter guarantees 6 real options for every selected pick before the
  // cockpit ever opens (draft.ts's ensureImageOptions), "find more" is now an
  // explicit escalation beyond that guaranteed default, up to 10 total.
  const options = photoOptions.filter((o) => o.url).slice(0, MAX_OPTIONS);

  async function saveUrl(url: string) {
    setBusy(true); setErr(null);
    const res = await fetch(base, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ url }),
    }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (res?.ok) onSaved(res.url);
    else setErr(res?.error ?? "Failed to set image");
  }

  async function findMore() {
    setFinding(true); setErr(null);
    const res = await fetch(`/api/admin/editions/${editionId}/picks/${pickId}/find-more-images`, { method: "POST" })
      .then((r) => r.json()).catch(() => null);
    setFinding(false);
    if (res?.ok) onMoreFound();
    else setErr(res?.error ?? "Couldn't find more options");
  }

  async function upload(file: File) {
    setBusy(true); setErr(null);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(base, { method: "POST", body: form }).then((r) => r.json()).catch(() => null);
    setBusy(false);
    if (res?.ok) onSaved(res.url);
    else setErr(res?.error ?? "Upload failed");
  }

  return (
    <div className="ed-image">
      <div className="ed-image-current">
        {currentUrl ? <img src={currentUrl} alt="" /> : <span className="ed-image-empty">No image</span>}
      </div>
      {options.length > 0 ? (
        <div className="ed-image-options">
          {options.map((o, i) => (
            <button
              key={i} type="button"
              className={`ed-image-opt${o.url === currentUrl ? " ed-image-opt-active" : ""}`}
              disabled={busy} onClick={() => saveUrl(o.url)} title={o.attribution ?? o.source}
            >
              <img src={o.url} alt="" />
            </button>
          ))}
        </div>
      ) : null}
      {options.length < MAX_OPTIONS ? (
        <button type="button" className="ed-find-more" disabled={finding} onClick={findMore}>
          {finding ? "Searching…" : `Find more options (${options.length}/${MAX_OPTIONS})`}
        </button>
      ) : null}
      <div className="ed-image-row">
        <input
          type="url" placeholder="Paste an image URL" value={pasteUrl}
          onChange={(e) => setPasteUrl(e.target.value)}
        />
        <button
          type="button" className="btn btn-quiet btn-sm" disabled={!pasteUrl || busy}
          onClick={() => { saveUrl(pasteUrl); setPasteUrl(""); }}
        >
          Use URL
        </button>
        <label className="btn btn-quiet btn-sm ed-upload-btn">
          {busy ? "Uploading…" : "Upload"}
          <input
            type="file" accept="image/jpeg,image/png,image/webp,image/gif" hidden disabled={busy}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }}
          />
        </label>
      </div>
      {err ? <p className="ed-image-error">{err}</p> : null}
    </div>
  );
}
