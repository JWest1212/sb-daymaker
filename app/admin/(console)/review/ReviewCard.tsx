"use client";

import { useState } from "react";
import Link from "next/link";
import {
  chipLabel, confidenceTier, NEIGHBORHOODS, OCCASION_TAGS,
  type ChipKind, type QueueRow, type ReviewDraft,
} from "@/lib/review";
import { ImagePicker } from "./ImagePicker";
import { WeightNudge } from "../WeightNudge";

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
        REGISTRY RHYTHM, copy these details into{" "}
        <Link href="/admin/coverage/recurring-rhythms" target="_blank" onClick={(e) => e.stopPropagation()}>
          Recurring Rhythms
        </Link>
        , then reject this card
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
  if (item.happening_tier === 3) return { text: "Place record, no start time to verify", href: url };
  if (item.starts_at) return { text: h ? `Start from ${h}` : "Start from source", href: url };
  return { text: "Recurring, confirm cadence", href: url };
}

const priceLabel = (b: string | null) => (b == null ? "price n/a" : b === "free" ? "free" : b);
const norm = (s: string | null | undefined) => (s ?? "").trim();

export function ReviewCard({
  item, active, editing, hero, pickIndex, fetching, draft,
  onAct, onCycle, onTryFetch, onSelect, onDraftChange, onToggleTag, onToast, leaving,
}: {
  item: QueueRow;
  active: boolean;
  editing: boolean;
  hero: boolean;
  pickIndex: number;
  fetching: boolean;
  draft: ReviewDraft | null;
  onAct: (kind: "approve" | "edit" | "reject" | "hero") => void;
  onCycle: (dir: "prev" | "next") => void;
  onTryFetch: () => void;
  onSelect: () => void;
  onDraftChange: (patch: Partial<ReviewDraft>) => void;
  onToggleTag: (tag: string) => void;
  onToast?: (msg: string) => void;
  leaving: boolean;
}) {
  const prov = provenance(item);
  const chip: ChipKind = item.chip;
  const isOverlay = !!item.overlay_id;

  // Render the pending draft (if any) so an edited-but-not-yet-approved card shows
  // its pending state; fall back to the stored row otherwise.
  const d = draft;
  const dispTitle = d && norm(d.title) ? norm(d.title) : item.title;
  const dispBlurb = d ? (norm(d.blurb) || null) : item.blurb;
  const dispNeighborhood = d ? (d.neighborhood || null) : item.neighborhood;
  const dispTags = d ? d.tags : item.tags;
  const usePick = pickIndex > 0 || editing;
  const pickedOpt = item.photo_options[pickIndex];
  const dispPhotoUrl = usePick && pickedOpt?.url ? pickedOpt.url : item.photo_url;
  const dispPhotoSource = (usePick && pickedOpt?.source ? pickedOpt.source : item.photo_source) ?? "placeholder";
  const thumbCls = dispPhotoUrl ? (SOURCE_CLASS[dispPhotoSource] ?? "") : "placeholder";

  // What changed vs the stored row (drives the gold "Edited:" banner).
  const changes: string[] = [];
  if (d) {
    if (norm(d.title) && norm(d.title) !== item.title) changes.push("title");
    if (norm(d.blurb) !== norm(item.blurb)) changes.push("blurb");
    if (norm(d.blurb_long) !== norm(item.blurb_long)) changes.push("long blurb");
    if ((d.neighborhood || "") !== (item.neighborhood || "")) changes.push("neighborhood");
    const sameTags = d.tags.length === item.tags.length && d.tags.every((t) => item.tags.includes(t));
    if (!sameTags) changes.push("tags");
  }
  if (pickIndex > 0) changes.push("photo");

  return (
    <article
      className={`card${active ? " is-active" : ""}${editing ? " is-editing" : ""}${leaving ? " leaving" : ""}${isOverlay ? " is-overlay" : ""}`}
      onClick={onSelect}
    >
      {isOverlay ? <div className="overlay-kicker">✎ Founder edit of a live thing, the live version stays up until you approve</div> : null}
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
          <div className={`thumb ${dispPhotoUrl ? "" : "placeholder"} ${thumbCls}`}>
            {dispPhotoUrl ? <img src={dispPhotoUrl} alt="" className="thumb-img" /> : null}
            <span className="src-pill">{dispPhotoSource}</span>
          </div>
        )}

        <div className="body">
          <div className="row1">
            <span className={`tier t${item.happening_tier}`}>{TIER_LABEL[item.happening_tier]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <input
                  className="title-edit"
                  value={d?.title ?? item.title}
                  onChange={(e) => onDraftChange({ title: e.target.value })}
                  onClick={(e) => e.stopPropagation()}
                  aria-label="Title"
                />
              ) : (
                <h2 className="title">{dispTitle}</h2>
              )}
              <div className="cat">{item.happening_category}</div>
            </div>
            <WeightNudge thingId={item.id} title={item.title} weight={item.editorial_weight} onToast={onToast} />
            <button
              type="button"
              className={`herostar${hero ? " is-on" : ""}`}
              aria-pressed={hero}
              onClick={(e) => { e.stopPropagation(); onAct("hero"); }}
              title="Toggle hero eligibility (H)"
            >
              <span className="st">{hero ? "★" : "☆"}</span> Hero <span className="k">H</span>
            </button>
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
          ) : dispBlurb ? (
            <p className="blurb">{dispBlurb}</p>
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
            {item.data_confidence != null ? (
              <span className="confrow">
                <span className={`confbadge ${confidenceTier(item.data_confidence)}`}>
                  {Math.round(item.data_confidence * 100)}% confidence
                </span>
                {item.confidence_reasons.length ? (
                  <span className="confreasons">{item.confidence_reasons.join(" · ")}</span>
                ) : null}
              </span>
            ) : null}
            {editing ? (
              <span className="locknote">🔒 Start time is locked, reject &amp; re-ingest to change it.</span>
            ) : null}
          </div>

          {editing && draft ? (
            <div className="editmeta" onClick={(e) => e.stopPropagation()}>
              <label className="editlabel">Neighborhood
                <select className="edit-select" value={draft.neighborhood}
                  onChange={(e) => onDraftChange({ neighborhood: e.target.value })}>
                  <option value="">, none, </option>
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
                      title={disabled ? "Not allowed for this item" : undefined}
                      onClick={(e) => { e.stopPropagation(); onToggleTag(t); }}>
                      {t.replace(/_/g, " ")}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="meta">
              {dispNeighborhood ? <span className="hood">{dispNeighborhood.replace(/_/g, " ")}</span> : null}
              {dispTags.map((t) => <span key={t} className="tag">{t.replace(/_/g, " ")}</span>)}
              <span className="price">{priceLabel(item.price_band)}</span>
            </div>
          )}

          {changes.length ? (
            <div className="editnote">Edited: {changes.join(", ")} · press <b>A</b> to commit &amp; publish</div>
          ) : null}

          {item.registrySnippet ? (
            <RegistrySnippetPanel
              snippet={item.registrySnippet}
              onReject={(e) => { e.stopPropagation(); onAct("reject"); }}
            />
          ) : (
            <div className="actions pt">
              <button className="btn btn-approve" onClick={(e) => { e.stopPropagation(); onAct("approve"); }}>
                {isOverlay ? "Approve & replace live" : "Approve & publish"} <span className="k">A</span>
              </button>
              <button className="btn btn-edit" onClick={(e) => { e.stopPropagation(); onAct("edit"); }}>
                {editing ? "Done editing" : "Edit"} <span className="k">E</span>
              </button>
              <button className="btn btn-reject" onClick={(e) => { e.stopPropagation(); onAct("reject"); }}>
                {isOverlay ? "Discard edit" : "Reject"} <span className="k">R</span>
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
