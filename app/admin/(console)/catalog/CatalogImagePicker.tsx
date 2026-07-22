"use client";

import { useState } from "react";
import { ImagePicker } from "../review/ImagePicker";
import { BudgetChip } from "../BudgetChip";
import type { PhotoOption } from "@/lib/review";
import type { PlaceCandidate } from "@/app/api/admin/venues/lookup-place-ids/route";

export interface AppliedPhoto {
  url: string | null;
  source: string;
  attribution: string | null;
}

/** Live-catalog photo picker (Card Imagery follow-up, not in the Phase 1 spec).
 *  Browsing the thing's pre-fetched photo_options is free, the arrows only move a
 *  local index, no network, same as the Queue's picker. "Use this photo" is the one
 *  deliberate commit action: it posts straight to /api/admin/catalog/photo and
 *  applies to the live row immediately (metadata-immediate like WeightNudge, *  optimistic label, no separate "Save changes" step needed).
 *
 *  2026-07-10 addendum (Jim's ask, confirmed design: "venue-backed, invisible to
 *  me" + "auto-create a dedicated venue"), "Fetch candidates" / "Fetch via
 *  Google" now go through the SAME venue/pool system the Venues tab uses
 *  (/api/admin/catalog/venue-photos/fetch auto-attaches or auto-creates a venue
 *  behind the scenes), so a Google photo picked here still gets the compliant
 *  7-day refresh + dead-photo fallback + digest notification instead of being a
 *  raw, never-refreshed URL. The venue itself is never shown as a concept here, *  only a place_id/coordinates prompt surfaces, and only when the (possibly just
 *  auto-created) venue actually needs one to fetch anything. */
export function CatalogImagePicker({
  thingId,
  photoUrl,
  photoSource,
  photoAttribution,
  options: initialOptions,
  venueId: initialVenueId,
  placeId: initialPlaceId,
  lat: initialLat,
  lng: initialLng,
  onApplied,
  onVenueAttached,
  onOptionsFetched,
  onToast,
}: {
  thingId: string;
  photoUrl: string | null;
  photoSource: string | null;
  photoAttribution: string | null;
  options: PhotoOption[];
  venueId: string | null;
  placeId: string | null;
  lat: number | null;
  lng: number | null;
  onApplied: (photo: AppliedPhoto) => void;
  /** Fired the first time this thing gets attached to a venue (auto-created or an
   *  exact place_id match), lets the parent sync venue_id into its row state so a
   *  second fetch reuses the same venue instead of re-triggering creation logic. */
  onVenueAttached?: (venueId: string) => void;
  /** LC-9, fired whenever a fetch (venue-backed or "Search wider") widens the
   *  local option set, so the parent can persist it onto the row/sheet state, *  otherwise closing and reopening the sheet loses every fetched-but-not-yet-
   *  applied candidate (editing.photo_options only ever holds applied picks). */
  onOptionsFetched?: (options: PhotoOption[]) => void;
  onToast?: (msg: string, undo?: () => void) => void;
}) {
  const [options, setOptions] = useState<PhotoOption[]>(initialOptions);
  const [index, setIndex] = useState(() => {
    const liveUrl = photoUrl ?? "";
    const liveSource = photoSource ?? "placeholder";
    const i = initialOptions.findIndex((o) => o.url === liveUrl && o.source === liveSource);
    return i >= 0 ? i : 0;
  });
  const [busy, setBusy] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [searchingWider, setSearchingWider] = useState(false);
  const [venueId, setVenueId] = useState(initialVenueId);
  const [needsPlaceId, setNeedsPlaceId] = useState(false);
  const [needsCoords, setNeedsCoords] = useState(false);
  const [placeIdInput, setPlaceIdInput] = useState(initialPlaceId ?? "");
  const [latInput, setLatInput] = useState(initialLat != null ? String(initialLat) : "");
  const [lngInput, setLngInput] = useState(initialLng != null ? String(initialLng) : "");
  const [lookingUpPlaceId, setLookingUpPlaceId] = useState(false);
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [nearbyCandidates, setNearbyCandidates] = useState<PlaceCandidate[]>([]);

  const current = options[index];
  const isLive = !!current && (current.url || "") === (photoUrl ?? "") && current.source === (photoSource ?? "placeholder");

  const cycle = (dir: "prev" | "next") => {
    setIndex((i) => {
      const len = options.length;
      if (!len) return i;
      return dir === "next" ? (i + 1) % len : (i - 1 + len) % len;
    });
  };

  const doFetch = async (includeGoogle: boolean) => {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/catalog/venue-photos/fetch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thing_id: thingId, include_google: includeGoogle }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok) { onToast?.(res?.error ?? "Fetch failed"); return; }
      if (res.venue_id && res.venue_id !== venueId) { setVenueId(res.venue_id); onVenueAttached?.(res.venue_id); }
      setNeedsPlaceId(!res.venue_has_place_id);
      setNeedsCoords(!res.venue_has_coords);
      if (Array.isArray(res.options) && res.options.length) {
        setOptions(res.options);
        setIndex(0);
        onOptionsFetched?.(res.options);
        onToast?.(
          res.googleFetched
            ? `Found ${res.count} photo(s) (${res.wikimediaCount} Wikimedia + ${res.googleCount} Google)`
            : res.capHit
              ? "Monthly photo budget reached, resets on the 1st, showing Wikimedia results"
              : `Found ${res.wikimediaCount} Wikimedia photo(s)`,
        );
      } else {
        onToast?.(
          res.capHit
            ? "Monthly photo budget reached, resets on the 1st"
            : "No photos found yet" + (!res.venue_has_place_id && !res.venue_has_coords ? ", add a place_id or coordinates below" : ""),
        );
      }
    } finally {
      setFetching(false);
    }
  };

  // LC-13, "Search wider (free)": the standalone find-more-images fallback
  // (Wikimedia title-search, no venue/Google involved), merged into the same
  // local option set by URL so it doesn't clobber whatever's already fetched.
  const doSearchWider = async () => {
    setSearchingWider(true);
    try {
      const res = await fetch("/api/admin/catalog/find-more-images", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ thing_id: thingId }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok) { onToast?.(res?.error ?? "Search failed"); return; }
      const fresh: PhotoOption[] = Array.isArray(res.options) ? res.options : [];
      const seen = new Set(options.map((o) => o.url));
      const added = fresh.filter((o) => o.url && !seen.has(o.url));
      if (added.length) {
        const merged = [...options, ...added];
        setOptions(merged);
        onOptionsFetched?.(merged);
        onToast?.(`Found ${added.length} more option(s)`);
      } else {
        onToast?.("No new options found");
      }
    } finally {
      setSearchingWider(false);
    }
  };

  const saveLocationAndRefetch = async () => {
    if (!venueId) return;
    setFetching(true);
    try {
      const res = await fetch("/api/admin/venues/edit", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({
          venue_id: venueId,
          place_id: placeIdInput.trim() || null,
          lat: latInput.trim() ? Number(latInput) : null,
          lng: lngInput.trim() ? Number(lngInput) : null,
        }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok) { onToast?.(res?.error ?? "Save failed"); return; }
    } finally {
      setFetching(false);
    }
    await doFetch(false);
  };

  // 2026-07-10 addendum (Jim's ask, Part 2: embed the Venues tab's lookup here), // scoped to just this thing's venue (never the whole registry). Pre-fills the
  // manual inputs above rather than saving directly, so a weak/wrong match never
  // lands without Jim seeing it first, same review-before-write principle as the
  // Venues tab's own bulk lookup.
  const fillCandidate = (c: PlaceCandidate) => {
    setPlaceIdInput(c.place_id);
    setLatInput(String(c.lat));
    setLngInput(String(c.lng));
  };

  const doLookupPlaceId = async () => {
    if (!venueId) return;
    setLookingUpPlaceId(true);
    setLookupNote(null);
    setNearbyCandidates([]);
    try {
      const res = await fetch("/api/admin/venues/lookup-place-ids", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venue_id: venueId }),
      }).then((r) => r.json()).catch(() => null);
      if (!res?.ok) { onToast?.(res?.error ?? "Lookup failed"); return; }
      const strong = res.strongMatches?.[0];
      const weak = res.weakMatches?.[0];
      if (strong) {
        fillCandidate({ place_id: strong.proposed_place_id, lat: strong.proposed_lat, lng: strong.proposed_lng, name: strong.proposed_name, address: strong.proposed_address });
        setLookupNote(`Matched: ${strong.proposed_name}, ${strong.proposed_address}. Review, then Save & fetch.`);
      } else if (weak) {
        fillCandidate(weak.addressOnlyMatch);
        setNearbyCandidates(weak.nearbyCandidates);
        setLookupNote(
          weak.nearbyCandidates.length
            ? "Only found a bare address match, but here are real nearby places, pick one if it's right:"
            : "Only found a bare address match (no real business found nearby), review before saving.",
        );
      } else {
        setLookupNote("No Google match found for this venue's name.");
      }
    } finally {
      setLookingUpPlaceId(false);
    }
  };

  // LC-9, shared commit path for "Use this photo" and "Apply best": applies
  // immediately (no confirm step), so every caller gets an Undo on its toast
  // that re-applies whatever was live a moment ago.
  const applyOption = async (opt: PhotoOption, successMsg: string) => {
    if (busy) return;
    setBusy(true);
    const prev: AppliedPhoto = { url: photoUrl, source: photoSource ?? "placeholder", attribution: photoAttribution };
    try {
      const res = await fetch("/api/admin/catalog/photo", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          thing_id: thingId,
          url: opt.url || null,
          source: opt.source,
          attribution: opt.attribution ?? null,
          venue_photo_id: opt.venuePhotoId,
        }),
      }).then((r) => r.json()).catch(() => null);
      if (res?.ok) {
        onApplied({ url: opt.url || null, source: opt.source, attribution: opt.attribution ?? null });
        const undo = () => {
          fetch("/api/admin/catalog/photo", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ thing_id: thingId, url: prev.url, source: prev.source, attribution: prev.attribution }),
          }).then((r) => r.json()).then((r2) => {
            if (r2?.ok) { onApplied(prev); onToast?.("Reverted"); }
            else onToast?.(r2?.error ?? "Undo failed");
          }).catch(() => onToast?.("Undo failed"));
        };
        onToast?.(successMsg, undo);
      } else {
        onToast?.(res?.error ?? "Couldn't apply that photo");
      }
    } finally {
      setBusy(false);
    }
  };

  const useThisPhoto = () => {
    if (!current || isLive) return;
    applyOption(current, current.source === "placeholder" ? "Photo removed, showing the gradient now" : "Photo updated, live now");
  };

  const best = options[0];
  const bestIsLive = !!best && (best.url || "") === (photoUrl ?? "") && best.source === (photoSource ?? "placeholder");
  const applyBest = () => {
    if (!best || bestIsLive) return;
    applyOption(best, `Applied the top photo (${best.source}), live now`);
  };

  return (
    <div className="catphoto">
      <ImagePicker options={options} index={index} onCycle={cycle} onTryFetch={() => doFetch(false)} fetching={fetching} />
      <div className="catphoto-fetchrow">
        <button type="button" className="btn btn-edit btn-sm" disabled={fetching} onClick={() => doFetch(false)}>
          {fetching ? "Fetching…" : "Fetch free candidates (Wikimedia · no cost)"}
        </button>
        <button type="button" className="btn btn-quiet btn-sm" disabled={fetching} onClick={() => doFetch(true)}>
          {fetching ? "Fetching…" : "Fetch via Google (1 paid call · counts to budget)"}
        </button>
        <button type="button" className="btn btn-quiet btn-sm" disabled={searchingWider} onClick={doSearchWider}>
          {searchingWider ? "Searching…" : "Search wider (free)"}
        </button>
        <BudgetChip />
      </div>
      {(needsPlaceId || needsCoords) ? (
        <div className="catphoto-location">
          <p className="empty-note">
            {needsCoords && needsPlaceId
              ? "No place_id or coordinates on file for this yet, add one to fetch real photos."
              : needsPlaceId
                ? "No Google place_id on file yet, add one to also pull Google photos (Wikimedia already works)."
                : "No coordinates on file yet, add some to also pull Wikimedia photos (Google already works)."}
          </p>
          <div className="veditor-row">
            <label className="veditor-field">
              Google place_id
              <input value={placeIdInput} onChange={(e) => setPlaceIdInput(e.target.value)} placeholder="ChIJ…" />
            </label>
            <label className="veditor-field" style={{ maxWidth: 110 }}>
              Latitude
              <input value={latInput} onChange={(e) => setLatInput(e.target.value)} placeholder="34.4208" />
            </label>
            <label className="veditor-field" style={{ maxWidth: 110 }}>
              Longitude
              <input value={lngInput} onChange={(e) => setLngInput(e.target.value)} placeholder="-119.6982" />
            </label>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button type="button" className="btn btn-edit btn-sm" disabled={lookingUpPlaceId} onClick={doLookupPlaceId}>
              {lookingUpPlaceId ? "Looking up…" : "Look up automatically"}
            </button>
            <button type="button" className="btn btn-approve btn-sm" disabled={fetching} onClick={saveLocationAndRefetch}>
              Save &amp; fetch
            </button>
          </div>
          {lookupNote ? <p className="empty-note" style={{ marginTop: 6 }}>{lookupNote}</p> : null}
          {nearbyCandidates.length > 0 ? (
            <div className="matchlist" style={{ marginTop: 6 }}>
              {nearbyCandidates.map((c, i) => (
                <div className="pickrow" key={i} style={{ background: "transparent", border: "none", padding: "4px 0" }}>
                  <div className="pm"><span className="venuename">{c.name}</span>, {c.address}</div>
                  <div className="btnrow">
                    <button type="button" className="btn btn-approve btn-sm" onClick={() => fillCandidate(c)}>Use this</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {options.length > 0 ? (
        <div className="catphoto-meta">
          <span className="catphoto-attr">{current?.attribution ?? ""}</span>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn btn-quiet btn-sm" disabled={busy || bestIsLive} onClick={applyBest} title="Commit the top-ranked option in one click">
              {busy ? "Applying…" : "Apply best"}
            </button>
            <button type="button" className="btn btn-approve btn-sm" disabled={busy || isLive} onClick={useThisPhoto}>
              {busy ? "Applying…" : isLive ? "Currently live" : "Use this photo"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
