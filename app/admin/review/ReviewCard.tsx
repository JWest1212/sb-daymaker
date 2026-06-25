"use client";

import { chipLabel, type ChipKind, type QueueRow } from "@/lib/review";
import { ImagePicker } from "./ImagePicker";

const TIER_LABEL: Record<number, string> = {
  1: "TIER 1 · EVENT", 2: "TIER 2 · RECURRING", 3: "TIER 3 · PLACE",
};
const SOURCE_CLASS: Record<string, string> = {
  google: "places", pexels: "soho", wikimedia: "places", owned: "tm", placeholder: "placeholder",
};

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
  item, active, editing, pickIndex, fetching,
  onAct, onCycle, onTryFetch, onSelect, leaving,
}: {
  item: QueueRow;
  active: boolean;
  editing: boolean;
  pickIndex: number;
  fetching: boolean;
  onAct: (kind: "approve" | "edit" | "reject") => void;
  onCycle: (dir: "prev" | "next") => void;
  onTryFetch: () => void;
  onSelect: () => void;
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

          {item.blurb ? <p className="blurb">{item.blurb}</p> : null}

          <div className="timeblock">
            <div className="timeline">
              <span className={`chip ${chip}`}><span className="dot" />{chipLabel(chip)}</span>
              <span className="whenstr">{item.when}</span>
            </div>
            <span className="prov">
              {prov.text}
              {prov.href ? <> · <a href={prov.href} target="_blank" rel="noreferrer">view source ↗</a></> : null}
            </span>
          </div>

          <div className="meta">
            {item.neighborhood ? <span className="hood">{item.neighborhood.replace(/_/g, " ")}</span> : null}
            {item.tags.map((t) => <span key={t} className="tag">{t.replace(/_/g, " ")}</span>)}
            <span className="price">{priceLabel(item.price_band)}</span>
          </div>

          <div className="actions pt">
            <button className="btn btn-approve" onClick={(e) => { e.stopPropagation(); onAct("approve"); }}>
              Approve &amp; publish <span className="k">A</span>
            </button>
            <button className="btn btn-edit" onClick={(e) => { e.stopPropagation(); onAct("edit"); }}>
              {editing ? "Done editing" : "Edit"} <span className="k">E</span>
            </button>
            <button className="btn btn-reject" onClick={(e) => { e.stopPropagation(); onAct("reject"); }}>
              Reject <span className="k">R</span>
            </button>
            <span className="right">
              {editing ? "◂ ▸ cycle images" : chip === "green" ? "✓ trusted source" : chip === "amber" ? "⚠ needs a glance" : "place"}
            </span>
          </div>
        </div>
      </div>
    </article>
  );
}
