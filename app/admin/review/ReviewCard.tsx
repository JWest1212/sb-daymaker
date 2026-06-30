"use client";

import { useState } from "react";
import {
  chipLabel, NEIGHBORHOODS, OCCASION_TAGS,
  type ChipKind, type QueueRow, type ReviewDraft,
} from "@/lib/review";
import { ImagePicker } from "./ImagePicker";

const TIER_LABEL: Record<number, string> = {
  1: "TIER 1 · EVENT", 2: "TIER 2 · RECURRING", 3: "TIER 3 · PLACE",
};
const SOURCE_CLASS: Record<string, string> = {
  google: "places", pexels: "soho", wikimedia: "places", owned: "tm", placeholder: "placeholder",
};

/** Paste-ready snippet panel shown for registry-candidate items (§3.5). */
function RegistrySnippetPanel({
  snippet,
  onReject,
}: {
  snippet: string;
  onReject: (e: React.MouseEvent) => void;
}) {
  const [copied, setCopied] = useState(false);
  const copy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };
  return (
    <div className="registry-panel" onClick={(e) => e.stopPropagation()}>
      <div className="registry-label">
        REGISTRY RHYTHM — paste into <code>recurringRegistry.ts</code>, then reject this card
      </div>
      <pre className="registry-snippet">{snippet}</pre>
      <div className="actions pt">
        <button className="btn btn-approve" onClick={copy}>
          {copied ? "Copied!" : "Copy snippet"}
        </button>
        <button className="btn btn-reject" onClick={onReject}>
          Dismiss (reject after copying) <span className="k">R</span>
        </button>
      </div>
    </div>
  );
}

function host(url: string | null): string | null {
  if (!url || !/^https?:\/\//.test(url)) return null;
  try { return new URL(url).host.replace(/^www\./, ""); } catch { return null; }
}

function provenance(item: QueueRow): { text: string; href: string | null } {
  const h = host(item.source); // display only
  // The link target must be the FULL source URL (a bare host is a relative URL
  // and resolves to /admin/<host>). seed:google_places etc. -> no link.
  const url = item.source && /^https?:\/\//.test(item.source) ? item.source : null;
  if (item.happening_tier === 3) return { text: "Place record — no start time to verify", href: url };
  if (item.starts_at) return { text: h ? `Start from ${h}` : "Start from source", href: url };
  return { text: "Recurring — confirm cadence", href: url };
}

const priceLabel = (b: string | null) => (b == null ? "price n/a" : b === "free" ? "free" : b);

export function ReviewCard({
  item, active, editing, pickIndex, fetching, draft,
  onAct, onCycle, onTryFetch, onSelect, onDraftChange, onToggleTag, leaving,
}: {
  item: QueueRow;
  active: boolean;
  editing: boolean;
  pickIndex: number;
  fetching: boolean;
  draft: ReviewDraft | null;
  onAct: (kind: "approve" | "edit" | "reject") => void;
  onCycle: (dir: "prev" | "next") => void;
  onTryFetch: () => void;
  onSelect: () => void;
  onDraftChange: (patch: Partial<ReviewDraft>) => void;
  onToggleTag: (tag: string) => void;
  leaving: boolean;
}) {
  const prov = provenance(item);
  const chip: ChipKind = item.chip;
  const thumbCls = item.photo_url ? (SOURCE_CLASS[item.photo_source ?? "placeholder"] ?? "") : "placeholder";

  return (
    <article
      className={`card${active ? " is-active" : ""}${editing ? " is-editing" : ""}${leaving ? " leaving" : ""}`}
      onClick={onSelect}
    >
      <div className="card-grid">
        {editing ? (
          <ImagePicker
            options={item.photo_options}
            index={pickIndex}
            onCycle={onCycle}
            onTryFetch={onTryFetch}
            fetching={fetching}
          />
        ) : (
          <div className={`thumb ${item.photo_url ? "" : "placeholder"} ${thumbCls}`}>
            {item.photo_url ? <img src={item.photo_url} alt="" className="thumb-img" /> : null}
            <span className="src-pill">{item.photo_source ?? "placeholder"}</span>
          </div>
        )}

        <div className="body">
          <div className="row1">
            <span className={`tier t${item.happening_tier}`}>{TIER_LABEL[item.happening_tier]}</span>
            <div style={{ flex: 1 }}>
              <h2 className="title">{item.title}</h2>
              <div className="cat">{item.happening_category}</div>
            </div>
          </div>

          {editing && draft ? (
            <div className="editfields" onClick={(e) => e.stopPropagation()}>
              <label className="editlabel">Blurb
                <textarea className="edit-textarea" rows={2} value={draft.blurb}
                  onChange={(e) => onDraftChange({ blurb: e.target.value })} />
              </label>
              <label className="editlabel">Long blurb
                <textarea className="edit-textarea" rows={3} value={draft.blurb_long}
                  onChange={(e) => onDraftChange({ blurb_long: e.target.value })} />
              </label>
            </div>
          ) : item.blurb ? (
            <p className="blurb">{item.blurb}</p>
          ) : null}

          <div className="timeblock">
            <div className="timeline">
              <span className={`chip ${chip}`}><span className="dot" />{chipLabel(chip)}</span>
              <span className="whenstr">{item.when}</span>
            </div>
            <span className="prov">
              {prov.text}
              {prov.href ? <> · <a href={prov.href} target="_blank" rel="noreferrer">view source ↗</a></> : null}
            </span>
            {editing ? (
              <span className="locknote">🔒 Start time is locked — reject &amp; re-ingest to change it.</span>
            ) : null}
          </div>

          {editing && draft ? (
            <div className="editmeta" onClick={(e) => e.stopPropagation()}>
              <label className="editlabel">Neighborhood
                <select className="edit-select" value={draft.neighborhood}
                  onChange={(e) => onDraftChange({ neighborhood: e.target.value })}>
                  <option value="">— none —</option>
                  {NEIGHBORHOODS.map((n) => <option key={n} value={n}>{n.replace(/_/g, " ")}</option>)}
                </select>
              </label>
              <div className="tagtoggles" role="group" aria-label="Occasion tags">
                {OCCASION_TAGS.map((t) => {
                  const on = draft.tags.includes(t);
                  const disabled =
                    (t === "family_day" && !!item.is_21_plus) ||
                    (t === "free_sb" && item.price_band != null && item.price_band !== "free");
                  return (
                    <button key={t} type="button" className="tagtoggle" aria-pressed={on} disabled={disabled}
                      onClick={(e) => { e.stopPropagation(); onToggleTag(t); }}>
                      {t.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="meta">
              {item.neighborhood ? <span className="hood">{item.neighborhood.replace(/_/g, " ")}</span> : null}
              {item.tags.map((t) => <span key={t} className="tag">{t.replace(/_/g, " ")}</span>)}
              <span className="price">{priceLabel(item.price_band)}</span>
            </div>
          )}

          {item.registrySnippet ? (
            <RegistrySnippetPanel
              snippet={item.registrySnippet}
              onReject={(e) => { e.stopPropagation(); onAct("reject"); }}
            />
          ) : (
            <div className="actions pt">
              <button className="btn btn-approve" onClick={(e) => { e.stopPropagation(); onAct("approve"); }}>
                Approve &amp; publish <span className="k">A</span>
              </button>
              <button className="btn btn-edit" onClick={(e) => { e.stopPropagation(); onAct("edit"); }}>
                {editing ? "Save changes" : "Edit"} <span className="k">E</span>
              </button>
              <button className="btn btn-reject" onClick={(e) => { e.stopPropagation(); onAct("reject"); }}>
                Reject <span className="k">R</span>
              </button>
              <span className="right">
                {editing ? "◂ ▸ cycle images" : chip === "green" ? "✓ trusted source" : chip === "amber" ? "⚠ needs a glance" : "place"}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
