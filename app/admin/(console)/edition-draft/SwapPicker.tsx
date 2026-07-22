"use client";

import { useEffect, useState } from "react";
import type { CockpitCandidate } from "@/lib/edition/cockpitTypes";
import type { EditionSlot } from "@/lib/edition/types";
import { Sheet } from "../../ui/Sheet";

interface SearchThing { id: string; title: string; blurb: string | null; blurb_long: string | null; neighborhood: string | null; happening_tier: number }

/** Mirrors renderData.ts's blurbSourceFor / PickEditor's effectiveBlurb: the hero
 *  slot shows the longer blurb_long so what an operator previews here matches what
 *  would actually render if they swap it in. */
function candidateBlurb(slot: EditionSlot, blurb: string | null, blurbLong: string | null): string | null {
  return slot === "hero" ? blurbLong ?? blurb : blurb;
}

export function SwapPicker({
  slot, position, candidates, editionId, onClose, onPick,
}: {
  slot: EditionSlot;
  position: number;
  candidates: CockpitCandidate[];
  editionId: string;
  onClose: () => void;
  onPick: (thingId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchThing[]>([]);
  const [searching, setSearching] = useState(false);
  const showSearch = query.trim().length >= 2;

  // Debounced search-all (spec §5.1's "search-all fallback"). setState calls
  // live inside the timer callback, not the effect body, so this only ever
  // fires in response to the debounce elapsing, not on every render.
  useEffect(() => {
    if (!showSearch) return;
    const t = setTimeout(() => {
      setSearching(true);
      fetch(`/api/admin/editions/${editionId}/search-things?q=${encodeURIComponent(query)}`)
        .then((r) => r.json())
        .catch(() => null)
        .then((res) => { setResults(res?.things ?? []); setSearching(false); });
    }, 300);
    return () => clearTimeout(t);
  }, [query, editionId, showSearch]);

  return (
    <Sheet
      open
      onClose={onClose}
      titleId="swapTitle"
      title={<>Swap, {slot}{slot === "secondary" ? ` #${position + 1}` : ""}</>}
      footer={<button className="btn btn-edit" onClick={onClose}>Done</button>}
    >
      <input
        className="ed-search" placeholder="Search all published things…" value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      {showSearch ? (
        <>
          <p className="ed-swap-heading">Search results</p>
          {searching ? <p className="ed-swap-empty">Searching…</p> : null}
          {!searching && results.length === 0 ? <p className="ed-swap-empty">No matches</p> : null}
          {results.map((t) => (
            <div className="pickrow" key={t.id}>
              <div>
                <div className="ttl">{t.title}</div>
                <div className="pm">T{t.happening_tier} · {t.neighborhood ?? "·"}</div>
                {candidateBlurb(slot, t.blurb, t.blurb_long) ? (
                  <div className="ed-swap-blurb">{candidateBlurb(slot, t.blurb, t.blurb_long)}</div>
                ) : null}
              </div>
              <button className="btn btn-approve btn-sm pickbtn" onClick={() => onPick(t.id)}>Use</button>
            </div>
          ))}
        </>
      ) : (
        <>
          <p className="ed-swap-heading">Ranked candidates</p>
          {candidates.length === 0 ? (
            <div className="gatebox">No ranked alternates for this slot, search above for any published thing.</div>
          ) : candidates.map((c) => (
            <div className="pickrow" key={c.thing.id}>
              <div>
                <div className="ttl">{c.thing.title}{c.selected ? <span className="chip evergreen"> current</span> : null}</div>
                <div className="pm">{c.thing.when} · {c.thing.neighborhood ?? "·"}</div>
                {candidateBlurb(slot, c.thing.blurb, c.thing.blurb_long) ? (
                  <div className="ed-swap-blurb">{candidateBlurb(slot, c.thing.blurb, c.thing.blurb_long)}</div>
                ) : null}
              </div>
              <button className="btn btn-approve btn-sm pickbtn" disabled={c.selected} onClick={() => onPick(c.thing.id)}>
                {c.selected ? "Current" : "Use"}
              </button>
            </div>
          ))}
        </>
      )}
    </Sheet>
  );
}
