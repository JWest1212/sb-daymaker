"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { VenuesData, VenueRow, MatchProposal, NoMatchThing } from "@/lib/venuesServer";
import type { StrongMatch, WeakMatch, NoMatch, PlaceCandidate } from "@/app/api/admin/venues/lookup-place-ids/route";
import type { AttachedThing } from "@/app/api/admin/venues/[id]/things/route";
import { BudgetChip } from "../BudgetChip";
import { useFocusTrap } from "@/lib/useFocusTrap";

const TIER_LABEL: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };
const CATCHER_PAGE_SIZE = 40;
type CatcherTier = "all" | "1" | "2" | "3";

/** "google" -> "Google", "wikimedia" -> "Wikimedia", the source pill always
 *  spells the source out (not just a color cue), 2026-07-10 addendum. */
function sourceLabel(source: string): string {
  return source.charAt(0).toUpperCase() + source.slice(1);
}

function PhotoStrip({
  venue, onFetch, onFetchGoogle, onApprove, onRemove, onReorder, fetching,
}: {
  venue: VenueRow;
  onFetch: () => void;
  /** 2026-07-10 addendum: an always-available override (Jim's ask), Wikimedia
   *  stays the default via onFetch, but Google is never gated behind a
   *  quantity threshold; it's just a deliberate second click, always there. */
  onFetchGoogle: () => void;
  onApprove: (photoId: string) => void;
  onRemove: (photoId: string) => void;
  onReorder: (photoId: string, dir: "up" | "down") => void;
  fetching: boolean;
}) {
  return (
    <>
      <div className="photostrip-heading">
        <h4>Approved pool ({venue.approvedPhotos.length})</h4>
      </div>
      {venue.approvedPhotos.length === 0 ? (
        <p className="empty-note">No approved photos yet, fetch candidates below and approve a few (3–5 is the target pool size).</p>
      ) : (
        <div className="approvedstrip">
          {venue.approvedPhotos.map((p, i) => (
            <div className="approvedcard" key={p.id}>
              <div className="ac-media">
                {p.serving_url ? <img src={p.serving_url} alt="" /> : null}
                <span className={`cc-src ${p.source}`}>{sourceLabel(p.source)}</span>
                <div className="acbtns">
                  <button className="btn btn-quiet btn-sm" disabled={i === 0} onClick={() => onReorder(p.id, "up")} aria-label="Move earlier">◀</button>
                  <button className="btn btn-quiet btn-sm" disabled={i === venue.approvedPhotos.length - 1} onClick={() => onReorder(p.id, "down")} aria-label="Move later">▶</button>
                  <button className="btn btn-reject btn-sm" onClick={() => onRemove(p.id)} aria-label={`Remove ${sourceLabel(p.source)} photo from the approved pool`}>✕</button>
                </div>
              </div>
              {p.attribution ? <p className="cc-caption">{p.attribution}</p> : null}
            </div>
          ))}
        </div>
      )}

      <div className="photostrip-heading">
        <h4>Candidates ({venue.candidatePhotos.length})</h4>
        <button className="btn btn-edit btn-sm" onClick={onFetch} disabled={fetching || (!venue.place_id && !venue.lat)}>
          {fetching ? "Fetching…" : "Fetch free candidates (Wikimedia · no cost)"}
        </button>
        <button
          className="btn btn-quiet btn-sm"
          onClick={onFetchGoogle}
          disabled={fetching || !venue.place_id}
          title={!venue.place_id ? "Add a place_id in the editor above first" : undefined}
        >
          {fetching ? "Fetching…" : "Fetch via Google (1 paid call · counts to budget)"}
        </button>
        <BudgetChip />
      </div>
      {!venue.place_id ? (
        <p className="empty-note" style={{ marginTop: -4, fontWeight: 600 }}>
          ⚠ &ldquo;Fetch via Google&rdquo; is greyed out, this venue has no place_id yet. Add one in the editor
          above (Google&rsquo;s Place ID Finder, linked below, can look it up).
        </p>
      ) : null}
      <p className="empty-note" style={{ marginTop: -4 }}>
        &ldquo;Fetch free candidates&rdquo; is strictly free (Wikimedia, never expires), it never spends a Google
        call, no matter how few results come back. Google only fetches on &ldquo;Fetch via Google&rdquo;, a
        deliberate second click. Google returns the same up-to-10 photos every time (there&rsquo;s no &ldquo;load
        more&rdquo; on its end) and each click spends real cap budget, so re-clicking it won&rsquo;t turn up
        anything new unless Google&rsquo;s own listing for this place has changed.
      </p>
      {!venue.place_id && !venue.lat ? (
        <p className="empty-note">This venue has no coordinates either, so &ldquo;Fetch candidates&rdquo; is also greyed out, add at least one via the editor above.</p>
      ) : venue.candidatePhotos.length === 0 ? (
        <p className="empty-note">No candidates fetched yet.</p>
      ) : (
        <div className="candidategrid">
          {venue.candidatePhotos.map((p) => (
            <div className="candidatecard" key={p.id}>
              <div className="cc-media">
                {p.serving_url ? <img src={p.serving_url} alt="" /> : null}
                <span className={`cc-src ${p.source}`}>{sourceLabel(p.source)}</span>
                <div className="ccbtns">
                  <button className="btn btn-approve btn-sm" onClick={() => onApprove(p.id)}>Approve</button>
                  <button className="btn btn-reject btn-sm" onClick={() => onRemove(p.id)}>Reject</button>
                </div>
              </div>
              {p.attribution ? <p className="cc-caption">{p.attribution}</p> : null}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function VenueDetailSheet({
  venue, onClose, onSave, onArchive, onFetch, onFetchGoogle, onApprove, onRemove, onReorder, onDetached, onToast, fetching,
}: {
  venue: VenueRow;
  onClose: () => void;
  onSave: (patch: { display_name?: string; radius_m?: number; place_id?: string | null; lat?: number | null; lng?: number | null }) => void;
  onArchive: () => void;
  onFetch: () => void;
  onFetchGoogle: () => void;
  onApprove: (photoId: string) => void;
  onRemove: (photoId: string) => void;
  onReorder: (photoId: string, dir: "up" | "down") => void;
  /** V-8, fired after a successful detach so the parent can refresh the grid
   *  card's attachedCount; this sheet manages its own list's optimistic removal. */
  onDetached: () => void;
  onToast: (msg: string) => void;
  fetching: boolean;
}) {
  const [name, setName] = useState(venue.display_name);
  const [radius, setRadius] = useState(String(venue.radius_m));
  const [placeId, setPlaceId] = useState(venue.place_id ?? "");
  const [lat, setLat] = useState(venue.lat != null ? String(venue.lat) : "");
  const [lng, setLng] = useState(venue.lng != null ? String(venue.lng) : "");
  const [attached, setAttached] = useState<AttachedThing[] | null>(null);
  // V-14, the sheet only ever mounts while open, so the trap is active for its
  // whole lifetime; unmount (closing) restores focus to the triggering vcard.
  const sheetRef = useRef<HTMLDivElement | null>(null);
  useFocusTrap(sheetRef, true);
  // Derived, not its own state, avoids a synchronous setState at the top of
  // the fetch effect below (same shape as BudgetChip.tsx's fetch-on-mount).
  const [attachedForVenueId, setAttachedForVenueId] = useState<string | null>(null);
  const loadingAttached = attachedForVenueId !== venue.id;
  useEffect(() => {
    setName(venue.display_name); setRadius(String(venue.radius_m));
    setPlaceId(venue.place_id ?? "");
    setLat(venue.lat != null ? String(venue.lat) : "");
    setLng(venue.lng != null ? String(venue.lng) : "");
  }, [venue.id, venue.display_name, venue.radius_m, venue.place_id, venue.lat, venue.lng]);

  // V-7, fetched lazily per sheet open, not baked into the main loader's
  // upfront payload (which already carries every venue).
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/venues/${venue.id}/things`)
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        if (res?.ok) setAttached(res.things);
        setAttachedForVenueId(venue.id);
      })
      .catch(() => { if (!cancelled) setAttachedForVenueId(venue.id); });
    return () => { cancelled = true; };
  }, [venue.id]);

  const handleDetach = async (thingId: string) => {
    const res = await fetch("/api/admin/venues/detach", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thing_id: thingId }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      setAttached((prev) => (prev ? prev.filter((t) => t.id !== thingId) : prev));
      onToast("Detached");
      onDetached();
    } else {
      onToast(res?.error ?? "Detach failed");
    }
  };

  return (
    <>
      <div className="scrim show" onClick={onClose} />
      <div className="sheet show sheet--wide" role="dialog" aria-modal="true" aria-labelledby="vTitle" ref={sheetRef}>
        <h3 id="vTitle">{venue.display_name}<button className="x" aria-label="Close" onClick={onClose}>✕</button></h3>
        <div className="sbody">
          <div className="veditor-row">
            <label className="veditor-field">
              Display name
              <input value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <label className="veditor-field" style={{ maxWidth: 120 }}>
              Radius (m)
              <input type="number" min={25} value={radius} onChange={(e) => setRadius(e.target.value)} />
            </label>
          </div>
          <label className="veditor-field">
            Google place_id (needed to fetch Google candidates)
            <input value={placeId} onChange={(e) => setPlaceId(e.target.value)} placeholder="ChIJ…" />
          </label>
          <div className="veditor-row">
            <label className="veditor-field">
              Latitude (needed to fetch Wikimedia candidates)
              <input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="34.4208" />
            </label>
            <label className="veditor-field">
              Longitude
              <input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="-119.6982" />
            </label>
          </div>
          {!venue.place_id && !venue.lat ? (
            <p className="empty-note">
              No place_id or coordinates yet, nothing to fetch from until at least one is set. Find a place_id via
              Google&rsquo;s <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noreferrer">Place ID Finder</a>, or coordinates via any map.
            </p>
          ) : null}
          <div style={{ display: "flex", gap: 8 }}>
            <button
              className="btn btn-approve btn-sm"
              onClick={() => onSave({
                display_name: name,
                radius_m: Number(radius) || venue.radius_m,
                place_id: placeId.trim() || null,
                lat: lat.trim() ? Number(lat) : null,
                lng: lng.trim() ? Number(lng) : null,
              })}
            >
              Save
            </button>
            <button
              className="btn btn-quiet btn-sm"
              onClick={() => {
                if (window.confirm(`Archive "${venue.display_name}"?\n\nIts attached things keep their venue_id and last photo, they just stop rotating/matching further. Reversible from the archived-venues list.`)) onArchive();
              }}
            >
              Archive venue
            </button>
          </div>

          <div className="photostrip-heading">
            <h4>Attached things ({venue.attachedCount})</h4>
          </div>
          {loadingAttached ? (
            <p className="empty-note">Loading…</p>
          ) : !attached?.length ? (
            <p className="empty-note">Nothing attached yet.</p>
          ) : (
            <div className="matchlist">
              {attached.map((t) => (
                <div className="pickrow" key={t.id}>
                  <div>
                    <div className="ttl">
                      <a href={`/thing/${t.id}`} target="_blank" rel="noreferrer">{t.title}</a>{" "}
                      <span className={`tier t${t.happening_tier}`}>{TIER_LABEL[t.happening_tier] ?? "T?"}</span>
                    </div>
                    <div className="pm">{t.when}{t.status !== "published" ? ` · ${t.status}` : ""}</div>
                  </div>
                  <div className="btnrow">
                    <button className="btn btn-quiet btn-sm" onClick={() => handleDetach(t.id)}>Detach</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <PhotoStrip
            venue={venue}
            onFetch={onFetch}
            onFetchGoogle={onFetchGoogle}
            onApprove={onApprove}
            onRemove={onRemove}
            onReorder={onReorder}
            fetching={fetching}
          />
        </div>
      </div>
    </>
  );
}

export function VenuesView({ initial }: { initial: VenuesData }) {
  const [data, setData] = useState<VenuesData>(initial);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [detailId, setDetailId] = useState<string | null>(null);
  const [fetching, setFetching] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);
  const [strongMatches, setStrongMatches] = useState<StrongMatch[] | null>(null);
  const [weakMatches, setWeakMatches] = useState<WeakMatch[]>([]);
  const [placeIdNoMatches, setPlaceIdNoMatches] = useState<NoMatch[]>([]);
  const [placeIdDismissed, setPlaceIdDismissed] = useState<Set<string>>(new Set());
  const [retryQueries, setRetryQueries] = useState<Record<string, string>>({});
  const [lookingUpPlaceIds, setLookingUpPlaceIds] = useState(false);
  const [retryingVenueId, setRetryingVenueId] = useState<string | null>(null);

  // Phase 6 (V-1…V-6), the no-match catcher.
  const [catcherTier, setCatcherTier] = useState<CatcherTier>("all");
  const [catcherNoAddressOnly, setCatcherNoAddressOnly] = useState(false);
  const [catcherSearch, setCatcherSearch] = useState("");
  const [catcherPage, setCatcherPage] = useState(1);
  const [catcherBusy, setCatcherBusy] = useState(false);
  const [attachingFor, setAttachingFor] = useState<string | null>(null);
  const [attachVenueId, setAttachVenueId] = useState("");
  const [creatingFor, setCreatingFor] = useState<string | null>(null);
  const [createName, setCreateName] = useState("");
  const [createLookup, setCreateLookup] = useState<{ status: "loading" | "done"; note?: string } | null>(null);
  const [addingVenue, setAddingVenue] = useState(false);
  const [newVenueName, setNewVenueName] = useState("");

  // Occasion Tags spec §3.3, the Dog Friendly checklist.
  const [dogSearch, setDogSearch] = useState("");
  const [dogSavingId, setDogSavingId] = useState<string | null>(null);

  const showToast = useCallback((m: string) => { setToast(m); setTimeout(() => setToast(null), 3200); }, []);

  const refresh = useCallback(async (): Promise<VenuesData | null> => {
    const res: VenuesData | null = await fetch("/api/admin/venues").then((r) => r.json()).catch(() => null);
    if (res) setData(res);
    return res;
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && detailId) setDetailId(null); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detailId]);

  const approveMatch = useCallback(async (m: MatchProposal) => {
    const res = await fetch("/api/admin/venues/match", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ thing_id: m.thing_id, venue_id: m.venue_id }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) { showToast(`Attached to ${m.venue_display_name}`); refresh(); }
    else showToast(res?.error ?? "Attach failed");
  }, [refresh, showToast]);

  const dismissMatch = useCallback((thingId: string) => {
    setDismissed((prev) => new Set(prev).add(thingId));
  }, []);

  const doFetch = useCallback(async (venue: VenueRow, includeGoogle = false) => {
    setFetching(true);
    const res = await fetch("/api/admin/venues/photos/fetch", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ venue_id: venue.id, include_google: includeGoogle }),
    }).then((r) => r.json()).catch(() => null);
    setFetching(false);
    if (res?.ok) {
      showToast(
        res.googleFetched
          ? `Found ${res.count} candidate(s) (${res.wikimediaCount} Wikimedia + ${res.googleCount} Google)`
          : res.capHit
            ? "Monthly photo budget reached, resets on the 1st"
            : `Found ${res.wikimediaCount} Wikimedia candidate(s)`,
      );
    } else showToast(res?.error ?? "Fetch failed");
    await refresh();
  }, [refresh, showToast]);

  const doApprove = useCallback(async (photoId: string) => {
    const res = await fetch("/api/admin/venues/photos/approve", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photo_id: photoId }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) showToast("Approved");
    else showToast(res?.error ?? "Approve failed");
    await refresh();
  }, [refresh, showToast]);

  const doRemove = useCallback(async (photoId: string) => {
    const res = await fetch("/api/admin/venues/photos/remove", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photo_id: photoId }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      // V-9, a removed approved photo can re-resolve things that were serving it.
      if (res.reassigned) showToast(`Removed, ${res.reassigned} thing(s) re-picked from the remaining pool`);
    } else {
      showToast(res?.error ?? "Remove failed");
    }
    await refresh();
  }, [refresh, showToast]);

  const doReorder = useCallback(async (photoId: string, dir: "up" | "down") => {
    const res = await fetch("/api/admin/venues/photos/reorder", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ photo_id: photoId, direction: dir }),
    }).then((r) => r.json()).catch(() => null);
    if (!res?.ok) showToast(res?.error ?? "Reorder failed");
    await refresh();
  }, [refresh, showToast]);

  const doSave = useCallback(async (venueId: string, patch: { display_name?: string; radius_m?: number; place_id?: string | null; lat?: number | null; lng?: number | null }) => {
    const res = await fetch("/api/admin/venues/edit", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venue_id: venueId, ...patch }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) showToast("Saved"); else showToast(res?.error ?? "Save failed");
    await refresh();
  }, [refresh, showToast]);

  const toggleDogFriendly = useCallback(async (venue: VenueRow) => {
    setDogSavingId(venue.id);
    const res = await fetch("/api/admin/venues/edit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ venue_id: venue.id, dog_friendly: !venue.dog_friendly }),
    }).then((r) => r.json()).catch(() => null);
    setDogSavingId(null);
    if (!res?.ok) showToast(res?.error ?? "Save failed");
    await refresh();
  }, [refresh, showToast]);

  const doArchive = useCallback(async (venueId: string) => {
    const res = await fetch("/api/admin/venues/edit", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venue_id: venueId, status: "archived" }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) { showToast("Archived"); setDetailId(null); } else showToast(res?.error ?? "Archive failed");
    await refresh();
  }, [refresh, showToast]);

  // V-11, a first-class "New venue" control (previously venues only ever
  // got created indirectly, via a catalog auto-create or the catcher's
  // "Create venue from here"). Shares the same /venues/create route, just
  // without a from_thing_id to attach.
  const doAddVenue = useCallback(async () => {
    if (!newVenueName.trim()) return;
    const res = await fetch("/api/admin/venues/create", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: newVenueName.trim() }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) {
      showToast(`Created ${res.venue.display_name}`);
      setAddingVenue(false); setNewVenueName("");
      refresh();
    } else showToast(res?.error ?? "Create failed");
  }, [newVenueName, showToast, refresh]);

  // V-8, refresh() re-pulls attachedCount for the grid card; the sheet's own
  // attached-events list (VenueDetailSheet) manages its optimistic removal
  // itself since it owns that fetch.
  const doDetach = useCallback(async () => { await refresh(); }, [refresh]);

  const doUnarchive = useCallback(async (venueId: string, name: string) => {
    const res = await fetch("/api/admin/venues/edit", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venue_id: venueId, status: "active" }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) showToast(`${name} restored`); else showToast(res?.error ?? "Restore failed");
    await refresh();
  }, [refresh, showToast]);

  const doLookupPlaceIds = useCallback(async () => {
    setLookingUpPlaceIds(true);
    const res = await fetch("/api/admin/venues/lookup-place-ids", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" })
      .then((r) => r.json()).catch(() => null);
    setLookingUpPlaceIds(false);
    if (res?.ok) {
      setStrongMatches(res.strongMatches);
      setWeakMatches(res.weakMatches ?? []);
      setPlaceIdNoMatches(res.noMatches ?? []);
      setPlaceIdDismissed(new Set());
      setRetryQueries({});
      showToast(
        `${res.strongMatches.length} strong match(es), ${res.weakMatches?.length ?? 0} weak, ` +
          `${res.noMatches?.length ?? 0} with no result`,
      );
    } else showToast(res?.error ?? "Lookup failed");
  }, [showToast]);

  const applyPlaceCandidate = useCallback(async (venueId: string, venueName: string, c: PlaceCandidate) => {
    const res = await fetch("/api/admin/venues/edit", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ venue_id: venueId, place_id: c.place_id, lat: c.lat, lng: c.lng }),
    }).then((r) => r.json()).catch(() => null);
    if (res?.ok) { showToast(`${venueName} updated`); setPlaceIdDismissed((prev) => new Set(prev).add(venueId)); refresh(); }
    else showToast(res?.error ?? "Save failed");
  }, [refresh, showToast]);

  const skipPlaceId = useCallback((venueId: string) => {
    setPlaceIdDismissed((prev) => new Set(prev).add(venueId));
  }, []);

  const retryWeakMatch = useCallback(async (venueId: string) => {
    const query = retryQueries[venueId]?.trim();
    if (!query) return;
    setRetryingVenueId(venueId);
    const res = await fetch("/api/admin/venues/lookup-place-ids", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venue_id: venueId, query }),
    }).then((r) => r.json()).catch(() => null);
    setRetryingVenueId(null);
    if (!res?.ok) { showToast(res?.error ?? "Retry failed"); return; }
    if (res.strongMatches?.length) {
      setWeakMatches((prev) => prev.filter((w) => w.venue_id !== venueId));
      setStrongMatches((prev) => [...(prev ?? []), ...res.strongMatches]);
      showToast("Found a strong match, review it below");
    } else if (res.weakMatches?.length) {
      setWeakMatches((prev) => prev.map((w) => (w.venue_id === venueId ? res.weakMatches[0] : w)));
      showToast("Still no confident business match, try a different search");
    } else {
      showToast("No match found for that search");
    }
  }, [retryQueries, showToast]);

  const removeCatcherItem = useCallback((thingId: string) => {
    setData((d) => ({ ...d, noMatchCatcher: d.noMatchCatcher.filter((t) => t.id !== thingId) }));
  }, []);

  // V-4, persists via things.no_venue_ack; the row is gone for good, not just
  // dismissed for this render (unlike the "Matches to review" pane's dismiss).
  const doAck = useCallback(async (thingId: string) => {
    setCatcherBusy(true);
    const res = await fetch("/api/admin/venues/ack", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ thing_id: thingId }),
    }).then((r) => r.json()).catch(() => null);
    setCatcherBusy(false);
    if (res?.ok) { removeCatcherItem(thingId); showToast("Left on motif"); }
    else showToast(res?.error ?? "Couldn't dismiss");
  }, [removeCatcherItem, showToast]);

  // V-2 / V-5, both the typeahead attach and the one-click weak-guess route
  // through the SAME /venues/match the main "Matches to review" pane uses (it
  // already applies a pool photo immediately when one exists).
  const doAttach = useCallback(async (thingId: string, venueId: string, venueName: string) => {
    setCatcherBusy(true);
    const res = await fetch("/api/admin/venues/match", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ thing_id: thingId, venue_id: venueId }),
    }).then((r) => r.json()).catch(() => null);
    setCatcherBusy(false);
    if (res?.ok) {
      removeCatcherItem(thingId);
      setAttachingFor(null); setAttachVenueId("");
      showToast(`Attached to ${venueName}`);
      refresh();
    } else showToast(res?.error ?? "Attach failed");
  }, [removeCatcherItem, showToast, refresh]);

  // V-3, creates + attaches in one step. If the new venue still has no
  // place_id, reuses /venues/lookup-place-ids (single-venue mode) to try
  // filling one in immediately; a strong match saves straight through
  // /venues/edit, otherwise the founder fine-tunes it from the venue card below.
  const doCreateVenue = useCallback(async (t: NoMatchThing) => {
    if (!createName.trim()) return;
    setCatcherBusy(true);
    const res = await fetch("/api/admin/venues/create", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ display_name: createName.trim(), place_id: t.place_id, lat: t.lat, lng: t.lng, from_thing_id: t.id }),
    }).then((r) => r.json()).catch(() => null);
    setCatcherBusy(false);
    if (!res?.ok) { showToast(res?.error ?? "Create failed"); return; }

    removeCatcherItem(t.id);
    setCreatingFor(null); setCreateName("");
    showToast(`Created ${res.venue.display_name} and attached`);

    if (!res.venue.place_id) {
      setCreateLookup({ status: "loading" });
      const lu = await fetch("/api/admin/venues/lookup-place-ids", {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ venue_id: res.venue.id }),
      }).then((r) => r.json()).catch(() => null);
      if (lu?.ok && lu.strongMatches?.[0]) {
        const m = lu.strongMatches[0];
        await fetch("/api/admin/venues/edit", {
          method: "POST", headers: { "content-type": "application/json" },
          body: JSON.stringify({ venue_id: res.venue.id, place_id: m.proposed_place_id, lat: m.proposed_lat, lng: m.proposed_lng }),
        }).catch(() => null);
        setCreateLookup({ status: "done", note: `Found and saved a place_id: ${m.proposed_name}` });
      } else {
        setCreateLookup({ status: "done", note: "No confident place_id match, fine-tune it from the venue card below." });
      }
    }
    refresh();
  }, [createName, removeCatcherItem, showToast, refresh]);

  const filteredCatcher = data.noMatchCatcher.filter((t) => {
    if (catcherTier !== "all" && String(t.happening_tier) !== catcherTier) return false;
    if (catcherNoAddressOnly && t.address != null) return false;
    if (catcherSearch && !t.title.toLowerCase().includes(catcherSearch.toLowerCase())) return false;
    return true;
  });
  const catcherTotalPages = Math.max(1, Math.ceil(filteredCatcher.length / CATCHER_PAGE_SIZE));
  const catcherPageClamped = Math.min(catcherPage, catcherTotalPages);
  const catcherPageItems = filteredCatcher.slice((catcherPageClamped - 1) * CATCHER_PAGE_SIZE, catcherPageClamped * CATCHER_PAGE_SIZE);

  const visibleMatches = data.matches.filter((m) => !dismissed.has(m.thing_id));

  // Occasion Tags spec §3.3, suggested-first, then alphabetical, then filtered by search.
  const dogChecklist = [...data.venues]
    .filter((v) => !dogSearch || v.display_name.toLowerCase().includes(dogSearch.toLowerCase()))
    .sort((a, b) => {
      if (a.dog_friendly !== b.dog_friendly) return a.dog_friendly ? -1 : 1;
      if (a.dogFriendlySuggested !== b.dogFriendlySuggested) return a.dogFriendlySuggested ? -1 : 1;
      return a.display_name.localeCompare(b.display_name);
    });
  const dogFriendlyCount = data.venues.filter((v) => v.dog_friendly).length;
  const dogSuggestedUnconfirmedCount = data.venues.filter((v) => v.dogFriendlySuggested && !v.dog_friendly).length;
  const visibleStrongMatches = (strongMatches ?? []).filter((p) => !placeIdDismissed.has(p.venue_id));
  const visibleWeakMatches = weakMatches.filter((w) => !placeIdDismissed.has(w.venue_id));
  const detailVenue = data.venues.find((v) => v.id === detailId) ?? null;

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 1180 }}>
      <div className="vhead">
        <h1 className="qtitle">Venues<span className="count"> {data.venues.length} active</span></h1>
      </div>
      <p className="vsub">
        Founder-curated venues + photo pools (Card Imagery Phase 2). Approve a fuzzy match to attach a thing to a
        venue; curate 3–5 approved photos per venue so its events rotate through real, vetted photos instead of a
        generic auto-pick.
      </p>

      <div className="vsection">
        <h2 className="vsection-title">Matches to review ({visibleMatches.length})</h2>
        {visibleMatches.length === 0 ? (
          <p className="empty-note">Nothing to review, every published/needs_review thing either has no address, is already attached, or scores no match against a known venue.</p>
        ) : (
          <div className="matchlist">
            {visibleMatches.slice(0, 40).map((m) => (
              <div className="pickrow" key={m.thing_id}>
                <div>
                  <div className="ttl">{m.title}</div>
                  <div className="pm">{TIER_LABEL[m.happening_tier] ?? "T?"} · {m.address} · proposed: <span className="venuename">{m.venue_display_name}</span> (score {m.score.toFixed(1)})</div>
                </div>
                <div className="btnrow">
                  <button className="btn btn-approve btn-sm" onClick={() => approveMatch(m)}>Approve</button>
                  <button className="btn btn-quiet btn-sm" onClick={() => dismissMatch(m.thing_id)}>Not a match</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="vsection">
        <h2 className="vsection-title">No confident match ({filteredCatcher.length})</h2>
        <p className="vsub" style={{ marginBottom: 8 }}>
          Unattached things that either have no address or scored no match against any known venue, they&rsquo;re
          quietly sitting on a motif until you resolve them here.
        </p>
        <div className="filters" style={{ marginBottom: 4 }}>
          <div className="filterbar" role="group" aria-label="Filter by tier">
            {(["all", "1", "2", "3"] as CatcherTier[]).map((t) => (
              <button key={t} className="filt" aria-pressed={catcherTier === t} onClick={() => setCatcherTier(t)}>
                {t === "all" ? "All" : `T${t}`}
              </button>
            ))}
          </div>
          <div className="search"><span aria-hidden="true">⌕</span>
            <input type="search" value={catcherSearch} onChange={(e) => setCatcherSearch(e.target.value)} placeholder="Search titles…" aria-label="Search unmatched things" />
          </div>
        </div>
        <label className="floorchk" style={{ marginBottom: 10 }}>
          <input type="checkbox" checked={catcherNoAddressOnly} onChange={(e) => setCatcherNoAddressOnly(e.target.checked)} />
          No address only
        </label>

        {filteredCatcher.length === 0 ? (
          <p className="empty-note">Nothing here, every unattached thing either scored a match above or has been resolved.</p>
        ) : (
          <div className="matchlist">
            {catcherPageItems.map((t) => (
              <div className="pickrow" key={t.id}>
                <div style={{ width: "100%" }}>
                  <div className="ttl">{t.title} <span className={`tier t${t.happening_tier}`}>{TIER_LABEL[t.happening_tier] ?? "T?"}</span></div>
                  <div className="pm">{t.address ?? "no address on file"}</div>
                  {t.weakGuess ? (
                    <div className="pm" style={{ marginTop: 4 }}>
                      low-confidence guess: <span className="venuename">{t.weakGuess.venue_display_name}</span> (score {t.weakGuess.score.toFixed(1)})
                      <button
                        className="btn btn-approve btn-sm" style={{ marginLeft: 8 }} disabled={catcherBusy}
                        onClick={() => doAttach(t.id, t.weakGuess!.venue_id, t.weakGuess!.venue_display_name)}
                      >
                        Attach to {t.weakGuess.venue_display_name} (low confidence)
                      </button>
                    </div>
                  ) : null}
                  <div className="btnrow" style={{ marginTop: 8 }}>
                    <button
                      className="btn btn-edit btn-sm"
                      onClick={() => { setAttachingFor(attachingFor === t.id ? null : t.id); setCreatingFor(null); }}
                    >
                      Attach to existing…
                    </button>
                    <button
                      className="btn btn-edit btn-sm"
                      onClick={() => { setCreatingFor(creatingFor === t.id ? null : t.id); setCreateName(t.title); setAttachingFor(null); }}
                    >
                      Create venue from here…
                    </button>
                    <button className="btn btn-quiet btn-sm" disabled={catcherBusy} onClick={() => doAck(t.id)}>
                      Leave on motif
                    </button>
                  </div>

                  {attachingFor === t.id ? (
                    <div className="veditor-row" style={{ marginTop: 8 }}>
                      <label className="veditor-field">
                        Venue
                        <select value={attachVenueId} onChange={(e) => setAttachVenueId(e.target.value)}>
                          <option value="">Choose a venue…</option>
                          {data.venues.map((v) => (
                            <option key={v.id} value={v.id}>
                              {v.display_name} ({v.approvedPhotos.length} photo{v.approvedPhotos.length === 1 ? "" : "s"})
                            </option>
                          ))}
                        </select>
                      </label>
                      <button
                        className="btn btn-approve btn-sm" style={{ alignSelf: "flex-end" }}
                        disabled={!attachVenueId || catcherBusy}
                        onClick={() => {
                          const v = data.venues.find((x) => x.id === attachVenueId);
                          if (v) doAttach(t.id, v.id, v.display_name);
                        }}
                      >
                        Attach
                      </button>
                    </div>
                  ) : null}

                  {creatingFor === t.id ? (
                    <div className="veditor-row" style={{ marginTop: 8 }}>
                      <label className="veditor-field">
                        New venue name
                        <input value={createName} onChange={(e) => setCreateName(e.target.value)} />
                      </label>
                      <button
                        className="btn btn-approve btn-sm" style={{ alignSelf: "flex-end" }}
                        disabled={!createName.trim() || catcherBusy}
                        onClick={() => doCreateVenue(t)}
                      >
                        Create &amp; attach
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}

        {catcherTotalPages > 1 ? (
          <div className="pager">
            <button disabled={catcherPageClamped <= 1} onClick={() => setCatcherPage(catcherPageClamped - 1)}>← Prev</button>
            <span>Page {catcherPageClamped} of {catcherTotalPages}</span>
            <button disabled={catcherPageClamped >= catcherTotalPages} onClick={() => setCatcherPage(catcherPageClamped + 1)}>Next →</button>
          </div>
        ) : null}

        {createLookup ? (
          <p className="empty-note" style={{ marginTop: 8 }}>
            {createLookup.status === "loading" ? "Looking up a place_id for the new venue…" : createLookup.note}
          </p>
        ) : null}
      </div>

      <div className="vsection">
        <h2 className="vsection-title">Place ID lookup</h2>
        <p className="vsub" style={{ marginBottom: 8 }}>
          Automatically finds a Google place_id for every venue missing one (needed for &ldquo;Fetch via Google&rdquo;
          to work). Nothing is saved until you approve a proposed match.
        </p>
        <button className="btn btn-edit btn-sm" onClick={doLookupPlaceIds} disabled={lookingUpPlaceIds}>
          {lookingUpPlaceIds ? "Looking up…" : "Look up place_ids for venues missing one"}
        </button>
        {strongMatches !== null ? (
          <div className="matchlist" style={{ marginTop: 10 }}>
            {visibleStrongMatches.length === 0 && visibleWeakMatches.length === 0 ? (
              <p className="empty-note">Nothing left to review.</p>
            ) : (
              <>
                {visibleStrongMatches.map((p) => (
                  <div className="pickrow" key={p.venue_id}>
                    <div>
                      <div className="ttl">{p.venue_display_name}</div>
                      <div className="pm">matched: <span className="venuename">{p.proposed_name}</span>, {p.proposed_address}</div>
                    </div>
                    <div className="btnrow">
                      <button className="btn btn-approve btn-sm" onClick={() => applyPlaceCandidate(p.venue_id, p.venue_display_name, { place_id: p.proposed_place_id, lat: p.proposed_lat, lng: p.proposed_lng, name: p.proposed_name, address: p.proposed_address })}>Approve</button>
                      <button className="btn btn-quiet btn-sm" onClick={() => skipPlaceId(p.venue_id)}>Skip</button>
                    </div>
                  </div>
                ))}
                {visibleWeakMatches.map((w) => (
                  <div className="pickrow weakmatch" key={w.venue_id}>
                    <div style={{ width: "100%" }}>
                      <div className="ttl">{w.venue_display_name}
                        <span className="weakflag"> ⚠ weak match, probably just a geocoded address, not a real business</span>
                      </div>
                      {w.nearbyCandidates.length > 0 ? (
                        <>
                          <div className="pm">Found nearby, pick one if it&rsquo;s the right place:</div>
                          {w.nearbyCandidates.map((c, i) => (
                            <div className="pickrow" key={i} style={{ background: "transparent", border: "none", padding: "4px 0" }}>
                              <div className="pm"><span className="venuename">{c.name}</span>, {c.address}</div>
                              <div className="btnrow">
                                <button className="btn btn-approve btn-sm" onClick={() => applyPlaceCandidate(w.venue_id, w.venue_display_name, c)}>Use this</button>
                              </div>
                            </div>
                          ))}
                        </>
                      ) : (
                        <div className="pm">No named places found nearby either.</div>
                      )}
                      <div className="pm" style={{ marginTop: 6 }}>
                        Or use the bare address match: {w.addressOnlyMatch.address}
                        <button className="btn btn-quiet btn-sm" style={{ marginLeft: 8 }} onClick={() => applyPlaceCandidate(w.venue_id, w.venue_display_name, w.addressOnlyMatch)}>Use address match</button>
                      </div>
                      <div className="veditor-row" style={{ marginTop: 8 }}>
                        <label className="veditor-field">
                          Know the real name? Search again
                          <input
                            value={retryQueries[w.venue_id] ?? ""}
                            onChange={(e) => setRetryQueries((prev) => ({ ...prev, [w.venue_id]: e.target.value }))}
                            placeholder="e.g. Santa Barbara Public Library, Santa Barbara CA"
                          />
                        </label>
                        <button
                          className="btn btn-edit btn-sm" style={{ alignSelf: "flex-end" }}
                          disabled={retryingVenueId === w.venue_id || !retryQueries[w.venue_id]?.trim()}
                          onClick={() => retryWeakMatch(w.venue_id)}
                        >
                          {retryingVenueId === w.venue_id ? "Searching…" : "Search again"}
                        </button>
                      </div>
                      <button className="btn btn-quiet btn-sm" style={{ marginTop: 6 }} onClick={() => skipPlaceId(w.venue_id)}>Skip this venue</button>
                    </div>
                  </div>
                ))}
              </>
            )}
            {placeIdNoMatches.length > 0 ? (
              <p className="empty-note">
                No Google match at all for: {placeIdNoMatches.map((n) => n.venue_display_name).join(", ")}.
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="vsection">
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <h2 className="vsection-title" style={{ margin: 0 }}>Venues ({data.venues.length})</h2>
          <button className="btn btn-edit btn-sm" onClick={() => setAddingVenue((o) => !o)}>+ New venue</button>
        </div>
        {addingVenue ? (
          <div className="veditor-row" style={{ marginBottom: 12 }}>
            <label className="veditor-field">
              Display name
              <input value={newVenueName} onChange={(e) => setNewVenueName(e.target.value)} placeholder="e.g. The Granada Theatre" />
            </label>
            <button className="btn btn-approve btn-sm" style={{ alignSelf: "flex-end" }} disabled={!newVenueName.trim()} onClick={doAddVenue}>
              Create
            </button>
          </div>
        ) : null}
        <div className="venuegrid">
          {data.venues.map((v) => (
            <button className="vcard" key={v.id} onClick={() => setDetailId(v.id)}>
              <span className="vname">{v.display_name}</span>
              <span className="vmeta">{v.attachedCount} thing{v.attachedCount === 1 ? "" : "s"} attached</span>
              <span className={`vmeta${v.approvedPhotos.length === 0 ? " warn" : ""}`}>
                {v.approvedPhotos.length} approved photo{v.approvedPhotos.length === 1 ? "" : "s"}
              </span>
              <div className="vthumbrow">
                {v.approvedPhotos.slice(0, 4).map((p) => (
                  <div className="vthumb" key={p.id}>{p.serving_url ? <img src={p.serving_url} alt="" /> : null}</div>
                ))}
                {v.approvedPhotos.length === 0 ? <div className="vthumb-empty">none</div> : null}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="vsection">
        <h2 className="vsection-title">Dog Friendly checklist ({dogFriendlyCount} marked)</h2>
        <p className="vsub">
          Mark the venues you know allow dogs, beaches, patios, trails, open-air tasting rooms. A thing
          at a dog-friendly venue shows under the Dog Friendly door automatically, live, no separate step.
          {dogSuggestedUnconfirmedCount > 0 ? (
            <> <b>{dogSuggestedUnconfirmedCount} suggested</b> below (name or category match), check the ones that are actually right, the rest need no action.</>
          ) : null}
        </p>
        <div className="search" style={{ marginBottom: 10 }}>
          <span aria-hidden="true">⌕</span>
          <input type="search" value={dogSearch} onChange={(e) => setDogSearch(e.target.value)} placeholder="Search venues…" aria-label="Search venues for Dog Friendly checklist" />
        </div>
        <div className="doglist">
          {dogChecklist.map((v) => (
            <label key={v.id} className={`dogrow${v.dog_friendly ? " on" : ""}`}>
              <input
                type="checkbox" checked={v.dog_friendly} disabled={dogSavingId === v.id}
                onChange={() => toggleDogFriendly(v)}
                aria-label={`${v.dog_friendly ? "Unmark" : "Mark"} ${v.display_name} as dog friendly`}
              />
              <span className="dname">{v.display_name}</span>
              <span className="dmeta">{v.attachedCount} thing{v.attachedCount === 1 ? "" : "s"}</span>
              {!v.dog_friendly && v.dogFriendlySuggested ? <span className="dsuggest">suggested</span> : null}
            </label>
          ))}
          {dogChecklist.length === 0 ? <p className="empty-note">No venues match &quot;{dogSearch}&quot;.</p> : null}
        </div>
      </div>

      {data.archivedVenues.length > 0 ? (
        <div className="vsection">
          <button
            className="btn btn-quiet btn-sm"
            onClick={() => setArchivedOpen((o) => !o)}
            aria-expanded={archivedOpen}
          >
            {archivedOpen ? "Hide" : "Show"} archived venues ({data.archivedVenues.length})
          </button>
          {archivedOpen ? (
            <div className="matchlist" style={{ marginTop: 10 }}>
              {data.archivedVenues.map((v) => (
                <div className="pickrow" key={v.id}>
                  <div className="ttl">{v.display_name}</div>
                  <div className="btnrow">
                    <button className="btn btn-approve btn-sm" onClick={() => doUnarchive(v.id, v.display_name)}>Un-archive</button>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {detailVenue ? (
        <VenueDetailSheet
          venue={detailVenue}
          onClose={() => setDetailId(null)}
          onSave={(patch) => doSave(detailVenue.id, patch)}
          onArchive={() => doArchive(detailVenue.id)}
          onFetch={() => doFetch(detailVenue)}
          onFetchGoogle={() => doFetch(detailVenue, true)}
          onApprove={doApprove}
          onRemove={doRemove}
          onReorder={doReorder}
          onDetached={doDetach}
          onToast={showToast}
          fetching={fetching}
        />
      ) : null}

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
