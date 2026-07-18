"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImagePicker } from "../review/ImagePicker";
import { BudgetChip } from "../BudgetChip";
import type { ImagesDeskData, ImagesDeskRow, ImagesVenueOption } from "@/lib/imagesServer";
import { dropRetiredPhotoOptions, STRONG_MATCH_SCORE, type PhotoOption } from "@/lib/review";

// Images desk (cockpit Images tab, 2026-07-11), the backlog worker for
// published things without a real photo. Modeled on the Queue's keyboard-first
// card flow, composing the machinery that already exists: the shared ImagePicker
// thumb, /api/admin/catalog/photo (apply), /api/admin/venues/match (attach +
// pool photo), /api/admin/catalog/venue-photos/fetch (paid Google, cap-guarded),
// and the free Wikimedia prefetch that fills candidate strips in the background.

const PAGE_SIZE = 40;
const TIER_LABEL: Record<number, string> = { 1: "T1", 2: "T2", 3: "T3" };
type Filter = "all" | "1" | "2" | "3";
interface Toast { msg: string; undo?: () => void; }

/** A this-session assignment (single apply, venue attach, or bulk auto-assign), *  kept so the strip at the top lets the founder eyeball results and revert. */
interface Assigned {
  row: ImagesDeskRow;
  url: string | null;
  source: string;
  how: "venue_pool" | "wikimedia" | "manual" | "venue" | "google";
  venueName?: string;
  attached_now: boolean;
  prev: { url: string | null; source: string; attribution: string | null };
}

/** One row of a bulk auto-assign / auto-google server response. */
interface AutoResult {
  id: string;
  action: string;
  reason?: string;
  url?: string;
  source?: string;
  attribution?: string | null;
  venue_id?: string;
  venue_name?: string;
  attached_now?: boolean;
  prev?: { url: string | null; source: string; attribution: string | null };
}

const post = (url: string, body: unknown) =>
  fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }).then((r) => r.json()).catch(() => null);

// Wikimedia / Google / owned only (Jim, 2026-07-11), historical pexels entries
// in stored photo_options are never offered, even on rows loaded before the
// server-side scrub existed.
const realOptions = (r: ImagesDeskRow): PhotoOption[] => dropRetiredPhotoOptions(r.photo_options.filter((o) => o.url));

export function ImagesView({ initial }: { initial: ImagesDeskData }) {
  const [rows, setRows] = useState<ImagesDeskRow[]>(initial.rows);
  const [venues, setVenues] = useState<ImagesVenueOption[]>(initial.venues);
  const [scanCapped, setScanCapped] = useState(initial.scanCapped);
  const [publishedTotal, setPublishedTotal] = useState(initial.publishedTotal);
  const [noImageTotal, setNoImageTotal] = useState(initial.noImageTotal);
  const [bulkProgress, setBulkProgress] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [noAddressOnly, setNoAddressOnly] = useState(false);
  const [poolBusyId, setPoolBusyId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [active, setActive] = useState(0);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [fetchingId, setFetchingId] = useState<string | null>(null);
  const [prefetchingIds, setPrefetchingIds] = useState<Set<string>>(new Set());
  const [dismissedSuggestions, setDismissedSuggestions] = useState<Set<string>>(new Set());
  const [attachOpenFor, setAttachOpenFor] = useState<string | null>(null);
  const [attachVenueId, setAttachVenueId] = useState("");
  const [assigned, setAssigned] = useState<Assigned[]>([]);
  const [autoRunning, setAutoRunning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchRequested = useRef(new Set<string>());

  const showToast = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3600);
  }, []);

  const visible = useMemo(
    () => rows.filter((r) => {
      if (filter !== "all" && String(r.happening_tier) !== filter) return false;
      if (noAddressOnly && r.address != null) return false;
      if (search && !r.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }),
    [rows, filter, search, noAddressOnly],
  );
  const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  const pageClamped = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => visible.slice((pageClamped - 1) * PAGE_SIZE, pageClamped * PAGE_SIZE),
    [visible, pageClamped],
  );

  // Clamp at render time (a removal can shrink the page under the cursor), // no state write needed, the next explicit ↑/↓ press re-anchors `active`.
  const activeIdx = Math.min(active, Math.max(0, pageItems.length - 1));

  const venueById = useMemo(() => new Map(venues.map((v) => [v.id, v])), [venues]);

  // The pool-build worklist: venues (attached or strongly suggested) that a
  // cluster of queue items shares but that have NO approved photos yet, one
  // approved photo there covers the whole cluster, free, forever.
  const poolTargets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of rows) {
      let vid: string | null = null;
      if (r.venue_id) { if (r.venue_approved_count === 0) vid = r.venue_id; }
      else if (r.suggestion && r.suggestion.approved_count === 0 && r.suggestion.score >= STRONG_MATCH_SCORE) vid = r.suggestion.venue_id;
      if (vid) counts.set(vid, (counts.get(vid) ?? 0) + 1);
    }
    return [...counts.entries()]
      .filter(([, n]) => n >= 2)
      .map(([id, n]) => ({ venue: venueById.get(id), count: n }))
      .filter((x): x is { venue: ImagesVenueOption; count: number } => !!x.venue)
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);
  }, [rows, venueById]);

  const removeRow = useCallback((id: string) => {
    setRows((rs) => rs.filter((r) => r.id !== id));
  }, []);

  const patchRow = useCallback((id: string, patch: Partial<ImagesDeskRow>) => {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  // ---- background Wikimedia prefetch (free) --------------------------------
  // Fill candidate strips for the visible page's option-less rows without any
  // per-card clicking. Each id is requested at most once per session; results
  // are also persisted server-side into photo_options so a reload keeps them.
  useEffect(() => {
    const need = pageItems.filter((r) => !realOptions(r).length && !prefetchRequested.current.has(r.id)).map((r) => r.id);
    if (!need.length) return;
    need.forEach((id) => prefetchRequested.current.add(id));
    let cancelled = false;
    (async () => {
      for (let i = 0; i < need.length; i += 8) {
        const batch = need.slice(i, i + 8);
        setPrefetchingIds((prev) => new Set([...prev, ...batch]));
        const res = await post("/api/admin/images/prefetch", { thing_ids: batch });
        if (cancelled) return;
        setPrefetchingIds((prev) => { const n = new Set(prev); batch.forEach((b) => n.delete(b)); return n; });
        if (res?.ok && res.options) {
          setRows((rs) => rs.map((r) => (res.options[r.id] ? { ...r, photo_options: res.options[r.id] } : r)));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [pageItems]);

  // ---- actions ---------------------------------------------------------------

  const refresh = useCallback(async () => {
    setRefreshing(true);
    const res = await fetch("/api/admin/images").then((r) => r.json()).catch(() => null);
    setRefreshing(false);
    if (res?.rows) {
      setRows(res.rows); setVenues(res.venues ?? []); setScanCapped(!!res.scanCapped);
      setPublishedTotal(res.publishedTotal ?? 0); setNoImageTotal(res.noImageTotal ?? 0);
    } else showToast("Refresh failed, showing the last loaded list");
  }, [showToast]);

  /** Revert a session assignment: re-apply the previous photo (normalized, a
   *  url-less motif/placeholder prev must go back as "placeholder", the photo
   *  route's explicit clear), detach if this session attached the venue, and
   *  put the row back at the top of the queue. */
  const revertAssign = useCallback(async (entry: Assigned) => {
    const prevSource = entry.prev.url ? entry.prev.source : "placeholder";
    const res = await post("/api/admin/catalog/photo", {
      thing_id: entry.row.id, url: entry.prev.url, source: prevSource, attribution: entry.prev.attribution,
    });
    if (!res?.ok) { showToast(res?.error ?? "Revert failed"); return; }
    if (entry.attached_now) await post("/api/admin/venues/detach", { thing_id: entry.row.id });
    setAssigned((a) => a.filter((x) => x !== entry));
    setRows((rs) => [
      {
        ...entry.row,
        photo_url: entry.prev.url,
        photo_source: prevSource,
        photo_attribution: entry.prev.attribution,
        ...(entry.attached_now ? { venue_id: null, venue_name: null, venue_approved_count: 0 } : {}),
      },
      ...rs.filter((r) => r.id !== entry.row.id),
    ]);
    showToast("Reverted, back in the queue");
  }, [showToast]);

  const applyOption = useCallback(async (row: ImagesDeskRow, opt: PhotoOption) => {
    if (busyId) return;
    setBusyId(row.id);
    const prev = { url: row.photo_url, source: row.photo_source ?? "placeholder", attribution: row.photo_attribution };
    const res = await post("/api/admin/catalog/photo", {
      thing_id: row.id, url: opt.url, source: opt.source, attribution: opt.attribution ?? null,
      venue_photo_id: opt.venuePhotoId,
    });
    setBusyId(null);
    if (!res?.ok) { showToast(res?.error ?? "Couldn't apply that photo"); return; }
    const entry: Assigned = { row, url: opt.url, source: opt.source, how: "manual", attached_now: false, prev };
    removeRow(row.id);
    setAssigned((a) => [entry, ...a]);
    showToast(`Applied (${opt.source}), live now`, () => revertAssign(entry));
  }, [busyId, removeRow, revertAssign, showToast]);

  const applySelected = useCallback((row: ImagesDeskRow) => {
    const real = realOptions(row);
    const opt = real[picks[row.id] ?? 0];
    if (opt) applyOption(row, opt);
  }, [picks, applyOption]);

  const applyBest = useCallback((row: ImagesDeskRow) => {
    const opt = realOptions(row)[0];
    if (opt) applyOption(row, opt);
  }, [applyOption]);

  const approveVenue = useCallback(async (row: ImagesDeskRow, venueId: string, venueName: string, approvedCount: number) => {
    if (busyId) return;
    setBusyId(row.id);
    const prev = { url: row.photo_url, source: row.photo_source ?? "placeholder", attribution: row.photo_attribution };
    const res = await post("/api/admin/venues/match", { thing_id: row.id, venue_id: venueId });
    setBusyId(null);
    if (!res?.ok) { showToast(res?.error ?? "Attach failed"); return; }
    setAttachOpenFor(null);
    setAttachVenueId("");
    if (approvedCount > 0) {
      const entry: Assigned = { row, url: null, source: "venue", how: "venue", venueName, attached_now: true, prev };
      removeRow(row.id);
      setAssigned((a) => [entry, ...a]);
      showToast(`Attached to ${venueName}, pool photo applied`, () => revertAssign(entry));
    } else {
      patchRow(row.id, { venue_id: venueId, venue_name: venueName, venue_approved_count: 0, suggestion: null });
      showToast(`Attached to ${venueName}, no approved photos yet, fetch some below`);
    }
  }, [busyId, patchRow, removeRow, revertAssign, showToast]);

  const ackAsIs = useCallback(async (row: ImagesDeskRow) => {
    if (busyId) return;
    setBusyId(row.id);
    const res = await post("/api/admin/images/ack", { thing_id: row.id });
    setBusyId(null);
    if (res?.ok) { removeRow(row.id); showToast("Left as-is, it won't reappear here"); }
    else showToast(res?.error ?? "Couldn't dismiss");
  }, [busyId, removeRow, showToast]);

  const doFreeSearch = useCallback(async (row: ImagesDeskRow) => {
    if (fetchingId) return;
    setFetchingId(row.id);
    const res = await post("/api/admin/images/prefetch", { thing_ids: [row.id] });
    setFetchingId(null);
    const options: PhotoOption[] | undefined = res?.ok ? res.options?.[row.id] : undefined;
    if (!options) { showToast(res?.error ?? "Search failed"); return; }
    const before = new Set(realOptions(row).map((o) => o.url));
    const added = options.filter((o) => o.url && !before.has(o.url)).length;
    patchRow(row.id, { photo_options: options });
    showToast(added ? `Found ${added} more free option(s)` : "No new free options found");
  }, [fetchingId, patchRow, showToast]);

  const doGoogleFetch = useCallback(async (row: ImagesDeskRow) => {
    if (fetchingId) return;
    setFetchingId(row.id);
    let res = await post("/api/admin/catalog/venue-photos/fetch", { thing_id: row.id, include_google: true });
    // Most ingested things have no place_id, instead of dead-ending, run the
    // same automatic place lookup the catalog picker exposes as a button, save
    // a STRONG match (never a bare-address geocode), and re-fetch.
    if (res?.ok && !(res.options?.length) && res.venue_id && !res.venue_has_place_id) {
      showToast("No place_id on file, looking it up automatically…");
      const lu = await post("/api/admin/venues/lookup-place-ids", { venue_id: res.venue_id });
      const strong = lu?.ok ? lu.strongMatches?.[0] : null;
      if (strong) {
        const saved = await post("/api/admin/venues/edit", {
          venue_id: res.venue_id, place_id: strong.proposed_place_id, lat: strong.proposed_lat, lng: strong.proposed_lng,
        });
        if (saved?.ok) res = await post("/api/admin/catalog/venue-photos/fetch", { thing_id: row.id, include_google: true });
      } else {
        setFetchingId(null);
        showToast(lu?.weakMatches?.length
          ? "Google only found a bare address here, not a business, pick the right place from the Venues tab"
          : "No Google place match found, add a place_id from the Venues tab");
        return;
      }
    }
    setFetchingId(null);
    if (!res?.ok) { showToast(res?.error ?? "Fetch failed"); return; }
    const patch: Partial<ImagesDeskRow> = {};
    if (res.venue_id && res.venue_id !== row.venue_id) {
      const known = venues.find((v) => v.id === res.venue_id);
      patch.venue_id = res.venue_id;
      patch.venue_name = known?.display_name ?? row.title;
      patch.venue_approved_count = known?.approved_count ?? 0;
      patch.suggestion = null;
    }
    if (Array.isArray(res.options) && res.options.length) {
      patch.photo_options = res.options;
      // You just paid for Google, pre-select the first Google result so A
      // applies what the press fetched (pool ordering can put Wikimedia first).
      const real = (res.options as PhotoOption[]).filter((o) => o.url);
      const gIdx = real.findIndex((o) => o.source === "google");
      setPicks((p) => ({ ...p, [row.id]: gIdx >= 0 ? gIdx : 0 }));
    }
    patchRow(row.id, patch);
    if (Array.isArray(res.options) && res.options.length) {
      showToast(
        res.googleFetched
          ? `Found ${res.count} photo(s) (${res.wikimediaCount} Wikimedia + ${res.googleCount} Google)`
          : res.capHit
            ? "Monthly photo budget reached, resets on the 1st, showing Wikimedia results"
            : `Found ${res.wikimediaCount} Wikimedia photo(s)`,
      );
    } else {
      showToast(
        res.capHit
          ? "Monthly photo budget reached, resets on the 1st"
          : "No photos found" + (!res.venue_has_place_id && !res.venue_has_coords ? ", this venue needs a place_id or coordinates (Venues tab)" : ""),
      );
    }
  }, [fetchingId, venues, patchRow, showToast]);

  const cyclePick = useCallback((row: ImagesDeskRow, dir: "prev" | "next") => {
    const n = realOptions(row).length;
    if (!n) return;
    setPicks((p) => {
      const cur = p[row.id] ?? 0;
      return { ...p, [row.id]: (cur + (dir === "next" ? 1 : -1) + n) % n };
    });
  }, []);

  /** Fold a bulk server result set into the desk: assigned items leave the
   *  queue and join the session strip; skipped-but-attached items keep their
   *  new venue. Returns the strip entries it created. */
  const processAutoResults = useCallback((results: AutoResult[], snapshot: ImagesDeskRow[]): Assigned[] => {
    const byId = new Map(snapshot.map((r) => [r.id, r]));
    const newEntries: Assigned[] = [];
    const removedIds = new Set<string>();
    for (const r of results) {
      const row = byId.get(r.id);
      if (!row) continue;
      if (r.action === "skipped") {
        if (r.attached_now && r.venue_id) {
          const known = venues.find((v) => v.id === r.venue_id);
          patchRow(r.id, { venue_id: r.venue_id, venue_name: known?.display_name ?? row.title, suggestion: null });
        }
        continue;
      }
      removedIds.add(r.id);
      newEntries.push({
        row, url: r.url ?? null, source: r.source ?? "wikimedia",
        how: r.action as Assigned["how"], venueName: r.venue_name,
        attached_now: !!r.attached_now,
        prev: r.prev ?? { url: row.photo_url, source: row.photo_source ?? "placeholder", attribution: row.photo_attribution },
      });
    }
    if (removedIds.size) setRows((rs) => rs.filter((x) => !removedIds.has(x.id)));
    if (newEntries.length) setAssigned((a) => [...newEntries, ...a]);
    return newEntries;
  }, [venues, patchRow]);

  const autoAssign = useCallback(async () => {
    const snapshot = pageItems;
    const targets = snapshot.map((r) => r.id);
    if (!targets.length || autoRunning) return;
    const okGo = window.confirm(
      `Auto-assign the best free image for ${targets.length} item(s) on this page?\n\n` +
        "Strong venue matches attach + use an approved pool photo; otherwise the top Wikimedia result is applied. " +
        "No paid Google calls. Everything lands in the reviewed strip with one-click revert.",
    );
    if (!okGo) return;
    setAutoRunning(true);
    const res = await post("/api/admin/images/auto-assign", { thing_ids: targets });
    setAutoRunning(false);
    if (!res?.ok) { showToast(res?.error ?? "Auto-assign failed"); return; }
    const entries = processAutoResults(res.results as AutoResult[], snapshot);
    showToast(`${entries.length} assigned · ${targets.length - entries.length} left for manual review`);
  }, [pageItems, autoRunning, processAutoResults, showToast]);

  // The whole-backlog variant: per chunk it (1) LOCATES items with no place_id
  // via the free-tier Text Search, the root-cause unlock for geosearch + venue
  // matching, (2) runs the free Wikimedia search for anything with no candidates
  // yet, then (3) auto-assigns. Across EVERY filtered row, not just the page.
  const autoAssignAll = useCallback(async () => {
    const snapshot = visible;
    const targets = snapshot.map((r) => r.id);
    if (!targets.length || autoRunning) return;
    const okGo = window.confirm(
      `Auto-assign the best free image for ALL ${targets.length} item(s) in this view?\n\n` +
        "First locates items missing a place_id (free-tier lookup, strong matches only), then runs the free Wikimedia " +
        "search, then assigns: strong venue matches use their approved pool, otherwise the top Wikimedia result. " +
        "No paid photo calls. Every assignment lands in the reviewed strip with one-click revert. " +
        "A large backlog can take several minutes, keep the tab open.",
    );
    if (!okGo) return;
    setAutoRunning(true);
    const needLocate = new Set(snapshot.filter((r) => !r.place_id).map((r) => r.id));
    const needSearch = new Set(snapshot.filter((r) => !realOptions(r).length).map((r) => r.id));
    needSearch.forEach((id) => prefetchRequested.current.add(id));
    let assignedCount = 0;
    let locatedCount = 0;
    try {
      for (let i = 0; i < targets.length; i += 60) {
        const chunk = targets.slice(i, i + 60);
        const locateIds = chunk.filter((id) => needLocate.has(id));
        for (let j = 0; j < locateIds.length; j += 25) {
          const batch = locateIds.slice(j, j + 25);
          setBulkProgress(`Locating ${i + j + batch.length}/${targets.length}…`);
          const loc = await post("/api/admin/images/locate", { thing_ids: batch });
          if (loc?.ok) {
            locatedCount += loc.located ?? 0;
            const byId = new Map((loc.results as { id: string; located: boolean; place_id?: string; lat?: number; lng?: number }[]).map((x) => [x.id, x]));
            setRows((rs) => rs.map((r) => {
              const l = byId.get(r.id);
              return l?.located ? { ...r, place_id: l.place_id ?? r.place_id, lat: l.lat ?? r.lat, lng: l.lng ?? r.lng } : r;
            }));
            // A fresh place_id/coords means the earlier "no candidates" search
            // is stale, let the prefetch stage re-run for these.
            for (const x of loc.results as { id: string; located: boolean }[]) if (x.located) needSearch.add(x.id);
          }
        }
        const searchIds = chunk.filter((id) => needSearch.has(id));
        for (let j = 0; j < searchIds.length; j += 8) {
          const batch = searchIds.slice(j, j + 8);
          setBulkProgress(`Searching ${i + j + batch.length}/${targets.length}…`);
          const pre = await post("/api/admin/images/prefetch", { thing_ids: batch });
          if (pre?.ok && pre.options) {
            setRows((rs) => rs.map((r) => (pre.options[r.id] ? { ...r, photo_options: pre.options[r.id] } : r)));
          }
        }
        setBulkProgress(`Assigning ${Math.min(i + chunk.length, targets.length)}/${targets.length}…`);
        const res = await post("/api/admin/images/auto-assign", { thing_ids: chunk });
        if (res?.ok) assignedCount += processAutoResults(res.results as AutoResult[], snapshot).length;
      }
    } finally {
      setBulkProgress(null);
      setAutoRunning(false);
    }
    showToast(
      `${assignedCount} assigned across ${targets.length} item(s)` +
        (locatedCount ? ` (${locatedCount} newly located)` : "") +
        ", review the strip, then Auto-Google the rest",
    );
  }, [visible, autoRunning, processAutoResults, showToast]);

  // The paid, opt-in second pass for what free assignment skipped: top-1 Google
  // photo per item, auto-approved into the venue pool, hard-stopped at the cap.
  // Runs across the whole filtered view in chunks; stops early on a cap hit.
  const autoGoogleAll = useCallback(async () => {
    const snapshot = visible;
    const targets = snapshot.map((r) => r.id);
    if (!targets.length || autoRunning) return;
    const okGo = window.confirm(
      `Auto-Google ALL ${targets.length} item(s) in this view?\n\n` +
        "Fetches only the TOP Google photo per item (~1 billable call each), auto-approves it into the venue pool " +
        "(compliant nightly refresh), and applies it. Items with no confident place match are skipped, never guessed. " +
        "Stops hard at the monthly cap, watch the budget chip.",
    );
    if (!okGo) return;
    setAutoRunning(true);
    let assignedCount = 0;
    let processed = 0;
    let capHit = false;
    try {
      for (let i = 0; i < targets.length; i += 60) {
        const chunk = targets.slice(i, i + 60);
        setBulkProgress(`Google ${Math.min(i + chunk.length, targets.length)}/${targets.length}…`);
        const res = await post("/api/admin/images/auto-google", { thing_ids: chunk });
        if (!res?.ok) { showToast(res?.error ?? "Auto-Google failed"); break; }
        assignedCount += processAutoResults(res.results as AutoResult[], snapshot).length;
        processed = Math.min(i + chunk.length, targets.length);
        if (res.capHit) { capHit = true; break; }
      }
    } finally {
      setBulkProgress(null);
      setAutoRunning(false);
    }
    showToast(
      `${assignedCount} assigned via Google/pool across ${processed} item(s)` +
        (capHit ? ", stopped at the monthly budget cap" : ""),
    );
  }, [visible, autoRunning, processAutoResults, showToast]);

  // Pool-build: one approved photo at a shared venue covers its whole cluster.
  // Server approves the best candidate + applies to attached items; the client
  // then auto-assigns the strongly-suggested (unattached) cluster members.
  const buildPool = useCallback(async (target: { venue: ImagesVenueOption; count: number }, includeGoogle: boolean) => {
    if (poolBusyId || autoRunning) return;
    setPoolBusyId(target.venue.id);
    const snapshot = rows;
    const res = await post("/api/admin/images/pool-build", { venue_id: target.venue.id, include_google: includeGoogle });
    setPoolBusyId(null);
    if (!res?.ok) { showToast(res?.error ?? "Pool build failed"); return; }
    if (!res.approved) {
      showToast(`${target.venue.display_name}: ${res.reason ?? "no pool photo found"}${includeGoogle ? "" : ", try “with Google”"}`);
      return;
    }
    setVenues((vs) => vs.map((v) => (v.id === target.venue.id ? { ...v, approved_count: Math.max(1, v.approved_count) } : v)));
    const appliedResults: AutoResult[] = (res.applied ?? []).map((a: { id: string; url: string; source: string; attribution: string | null; prev: AutoResult["prev"] }) => ({
      id: a.id, action: "venue_pool", url: a.url, source: a.source, attribution: a.attribution,
      venue_id: target.venue.id, venue_name: target.venue.display_name, attached_now: false, prev: a.prev,
    }));
    let assignedCount = processAutoResults(appliedResults, snapshot).length;
    const suggestIds = snapshot
      .filter((r) => !r.venue_id && r.suggestion?.venue_id === target.venue.id && r.suggestion.score >= STRONG_MATCH_SCORE)
      .map((r) => r.id).slice(0, 60);
    if (suggestIds.length) {
      const aa = await post("/api/admin/images/auto-assign", { thing_ids: suggestIds });
      if (aa?.ok) assignedCount += processAutoResults(aa.results as AutoResult[], snapshot).length;
    }
    // Remaining rows tied to this venue now know it has an approved photo.
    setRows((rs) => rs.map((r) =>
      r.venue_id === target.venue.id
        ? { ...r, venue_approved_count: Math.max(1, r.venue_approved_count) }
        : r.suggestion?.venue_id === target.venue.id
          ? { ...r, suggestion: { ...r.suggestion, approved_count: Math.max(1, r.suggestion.approved_count) } }
          : r,
    ));
    showToast(
      `${target.venue.display_name}: pool photo approved · ${assignedCount} item(s) assigned` +
        (res.capHit ? " · budget cap hit" : ""),
    );
  }, [poolBusyId, autoRunning, rows, processAutoResults, showToast]);

  // The honest tail: coordless/venueless items that per canon SHOULD stay on the
  // motif. Acts on the CURRENT FILTERED VIEW, filter first (e.g. Events + "No
  // address only"), then dismiss the lot. Permanent, like the per-card M.
  const ackAllView = useCallback(async () => {
    const targets = visible.map((r) => r.id);
    if (!targets.length || autoRunning) return;
    const okGo = window.confirm(
      `Permanently dismiss ${targets.length} item(s) in this view as “fine on the motif”?\n\n` +
        "They won't reappear in this queue. Tip: narrow the view first (e.g. Events + “No address only”) so this " +
        "only hits items no image source can anchor to.",
    );
    if (!okGo) return;
    setAutoRunning(true);
    setBulkProgress("Dismissing…");
    const res = await post("/api/admin/images/ack", { thing_ids: targets });
    setBulkProgress(null);
    setAutoRunning(false);
    if (!res?.ok) { showToast(res?.error ?? "Dismiss failed"); return; }
    const done = new Set<string>((res.acked as string[]) ?? targets);
    setRows((rs) => rs.filter((r) => !done.has(r.id)));
    showToast(`${done.size} left on motif, they won't reappear here`);
  }, [visible, autoRunning, showToast]);

  // One-press per-card variant (⇧G): top-1 paid fetch + apply, with Undo.
  const autoGoogleOne = useCallback(async (row: ImagesDeskRow) => {
    if (busyId || autoRunning) return;
    setBusyId(row.id);
    const res = await post("/api/admin/images/auto-google", { thing_ids: [row.id] });
    setBusyId(null);
    if (!res?.ok) { showToast(res?.error ?? "Auto-Google failed"); return; }
    const r = (res.results as AutoResult[])[0];
    if (!r || r.action === "skipped") {
      if (r?.attached_now && r.venue_id) {
        const known = venues.find((v) => v.id === r.venue_id);
        patchRow(row.id, { venue_id: r.venue_id, venue_name: known?.display_name ?? row.title, suggestion: null });
      }
      showToast(r?.reason ? `Skipped, ${r.reason}` : "Skipped");
      return;
    }
    const entry = processAutoResults([r], [row])[0];
    if (entry) showToast(`Applied (${entry.source}), live now`, () => revertAssign(entry));
  }, [busyId, autoRunning, venues, patchRow, processAutoResults, revertAssign, showToast]);

  // ---- keyboard map (mirrors the Queue's; guarded against field focus) -------
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName ?? "").toUpperCase();
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      const cur = pageItems[activeIdx];
      const k = e.key.toLowerCase();
      if (k === "arrowdown") { e.preventDefault(); setActive(Math.min(pageItems.length - 1, activeIdx + 1)); }
      else if (k === "arrowup") { e.preventDefault(); setActive(Math.max(0, activeIdx - 1)); }
      else if ((e.key === "ArrowLeft" || e.key === "ArrowRight") && cur) { e.preventDefault(); cyclePick(cur, e.key === "ArrowRight" ? "next" : "prev"); }
      else if (k === "a" && cur) { e.preventDefault(); applySelected(cur); }
      else if (k === "w" && cur) { e.preventDefault(); applyBest(cur); }
      else if (k === "v" && cur) {
        e.preventDefault();
        const s = cur.suggestion;
        if (s && !dismissedSuggestions.has(cur.id)) approveVenue(cur, s.venue_id, s.display_name, s.approved_count);
      }
      else if (k === "g" && cur) { e.preventDefault(); if (e.shiftKey) autoGoogleOne(cur); else doGoogleFetch(cur); }
      else if (k === "f" && cur) { e.preventDefault(); doFreeSearch(cur); }
      else if (k === "m" && cur) { e.preventDefault(); ackAsIs(cur); }
      else if (e.key === "Escape") { setAttachOpenFor(null); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pageItems, activeIdx, dismissedSuggestions, cyclePick, applySelected, applyBest, approveVenue, doGoogleFetch, autoGoogleOne, doFreeSearch, ackAsIs]);

  const HOW_LABEL: Record<Assigned["how"], string> = {
    venue_pool: "Venue pool", wikimedia: "Wikimedia (auto)", manual: "Picked", venue: "Venue pool", google: "Google (auto)",
  };

  return (
    <div className="wrap">
      <main>
        <div className="controls">
          <h1 className="qtitle">Images<span className="count">{visible.length} need{visible.length === 1 ? "s" : ""} an image</span></h1>
          <span className="spacer" />
          <div className="filterbar" role="group" aria-label="Filter by tier">
            {(["all", "1", "2", "3"] as Filter[]).map((f) => (
              <button key={f} className="filt" aria-pressed={filter === f}
                onClick={() => { setFilter(f); setPage(1); setActive(0); }}>
                {f === "all" ? "All" : f === "1" ? "Events" : f === "2" ? "Recurring" : "Places"}
              </button>
            ))}
          </div>
          <div className="search"><span aria-hidden="true">⌕</span>
            <input type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); setActive(0); }}
              placeholder="Search titles…" aria-label="Search imageless things" />
          </div>
          <label className="floorchk">
            <input type="checkbox" checked={noAddressOnly} onChange={(e) => { setNoAddressOnly(e.target.checked); setPage(1); setActive(0); }} />
            No address only
          </label>
          <button className="bulk" onClick={autoAssign} disabled={autoRunning || !pageItems.length}>
            ▣ Auto-free (page)
          </button>
          <button className="bulk" onClick={autoAssignAll} disabled={autoRunning || !visible.length}>
            {bulkProgress ?? `▣ Auto-free (all ${visible.length})`}
          </button>
          <button className="bulk" onClick={autoGoogleAll} disabled={autoRunning || !visible.length}>
            ▣ Auto-Google (all $)
          </button>
          <button className="bulk" onClick={ackAllView} disabled={autoRunning || !visible.length}
            title="Permanently dismiss everything in the current filtered view as fine-on-motif">
            Keep motif (view)
          </button>
          <BudgetChip />
        </div>

        {scanCapped ? (
          <p className="empty-note">Showing the first 1000 imageless items, work through these and Refresh for more.</p>
        ) : null}

        {poolTargets.length > 0 ? (
          <div className="panel idk-strip">
            <h3>Venue pools to build <span className="n">{poolTargets.length}</span></h3>
            <p className="empty-note" style={{ padding: "6px 16px" }}>
              One approved photo at a shared venue covers every queue item there, free, and it keeps auto-refreshing.
            </p>
            <div className="idk-striplist">
              {poolTargets.map((pt) => (
                <div className="idk-striprow" key={pt.venue.id}>
                  <span className="lthumb idk-thumb-venue" aria-hidden>🏛</span>
                  <div className="lmain">
                    <div className="lt"><span className="ttl">{pt.venue.display_name}</span></div>
                    <div className="lmeta"><span className="mono">{pt.count} queue item{pt.count === 1 ? "" : "s"} · no approved photos yet</span></div>
                  </div>
                  <button className="btn btn-edit btn-sm" disabled={poolBusyId === pt.venue.id || autoRunning}
                    onClick={() => buildPool(pt, false)}>
                    {poolBusyId === pt.venue.id ? "Building…" : "Build pool (free)"}
                  </button>
                  <button className="btn btn-quiet btn-sm" disabled={poolBusyId === pt.venue.id || autoRunning}
                    onClick={() => buildPool(pt, true)}>
                    with Google ($)
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {assigned.length > 0 ? (
          <div className="panel idk-strip">
            <h3>Assigned this session <span className="n">{assigned.length}</span></h3>
            <div className="idk-striplist">
              {assigned.map((a) => (
                <div className="idk-striprow" key={a.row.id}>
                  {a.url ? <img className="lthumb" src={a.url} alt="" /> : <span className="lthumb idk-thumb-venue" aria-hidden>🏛</span>}
                  <div className="lmain">
                    <div className="lt"><span className="ttl">{a.row.title}</span></div>
                    <div className="lmeta"><span className="mono">{HOW_LABEL[a.how]}{a.venueName ? `, ${a.venueName}` : ""}</span></div>
                  </div>
                  <button className="btn btn-quiet btn-sm" onClick={() => revertAssign(a)}>Revert</button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {pageItems.length === 0 ? (
          <div className="done show">
            <div className="sun">☀️</div>
            <h2>Nothing left without an image</h2>
            <p>Every published item in this view has a real photo, or you&rsquo;ve marked it fine as-is.</p>
          </div>
        ) : (
          pageItems.map((row, i) => {
            const real = realOptions(row);
            const pickIdx = Math.min(picks[row.id] ?? 0, Math.max(0, real.length - 1));
            const selected = real[pickIdx];
            const searching = fetchingId === row.id || prefetchingIds.has(row.id);
            const s = row.suggestion && !dismissedSuggestions.has(row.id) ? row.suggestion : null;
            return (
              <article key={row.id} className={`card ${i === activeIdx ? "is-active" : ""}`} onClick={() => setActive(i)}>
                <div className="card-grid">
                  <ImagePicker
                    options={real}
                    index={pickIdx}
                    onCycle={(dir) => cyclePick(row, dir)}
                    onTryFetch={() => doFreeSearch(row)}
                    fetching={searching}
                  />
                  <div className="body">
                    <div className="row1">
                      <span className={`tier t${row.happening_tier}`}>{TIER_LABEL[row.happening_tier] ?? "T?"}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <h2 className="title">{row.title}</h2>
                        <div className="cat">
                          {row.neighborhood ? row.neighborhood.replace(/_/g, " ") : "·"} · {row.address ?? "no address on file"}
                        </div>
                      </div>
                      <span className="idk-now">now: {row.photo_source ?? "no image"}</span>
                    </div>

                    {row.venue_id ? (
                      <div className="idk-venue is-attached">
                        <span aria-hidden>🏛</span> Attached: <b>{row.venue_name ?? "venue"}</b>
                        {row.venue_approved_count === 0
                          ? <span className="idk-warn">, no approved pool photos yet; fetch below</span>
                          : <span className="pm"> · {row.venue_approved_count} approved photo(s)</span>}
                      </div>
                    ) : s ? (
                      <div className="idk-venue">
                        <span aria-hidden>🏛</span> Likely venue: <b>{s.display_name}</b>
                        <span className="pm"> score {s.score.toFixed(1)} · {s.approved_count} approved photo(s)</span>
                        <span className="idk-venue-btns">
                          <button className="btn btn-approve btn-sm" disabled={busyId === row.id}
                            onClick={() => approveVenue(row, s.venue_id, s.display_name, s.approved_count)}>
                            {s.approved_count > 0 ? "Attach & use pool photo" : "Attach"} <span className="k">V</span>
                          </button>
                          <button className="btn btn-quiet btn-sm"
                            onClick={() => setDismissedSuggestions((prev) => new Set(prev).add(row.id))}>
                            Not a match
                          </button>
                          <button className="btn btn-edit btn-sm"
                            onClick={() => { setAttachOpenFor(attachOpenFor === row.id ? null : row.id); setAttachVenueId(""); }}>
                            Pick different…
                          </button>
                        </span>
                      </div>
                    ) : (
                      <div className="idk-venue is-none">
                        <span aria-hidden>🏛</span> No venue match
                        <span className="idk-venue-btns">
                          <button className="btn btn-edit btn-sm"
                            onClick={() => { setAttachOpenFor(attachOpenFor === row.id ? null : row.id); setAttachVenueId(""); }}>
                            Attach to a venue…
                          </button>
                        </span>
                      </div>
                    )}

                    {attachOpenFor === row.id ? (
                      <div className="veditor-row">
                        <label className="veditor-field">
                          Venue
                          <select value={attachVenueId} onChange={(e) => setAttachVenueId(e.target.value)}>
                            <option value="">Choose a venue…</option>
                            {venues.map((v) => (
                              <option key={v.id} value={v.id}>
                                {v.display_name} ({v.approved_count} photo{v.approved_count === 1 ? "" : "s"})
                              </option>
                            ))}
                          </select>
                        </label>
                        <button className="btn btn-approve btn-sm" style={{ alignSelf: "flex-end" }}
                          disabled={!attachVenueId || busyId === row.id}
                          onClick={() => {
                            const v = venues.find((x) => x.id === attachVenueId);
                            if (v) approveVenue(row, v.id, v.display_name, v.approved_count);
                          }}>
                          Attach
                        </button>
                      </div>
                    ) : null}

                    {real.length > 1 ? (
                      <div className="idk-opts" role="group" aria-label="Photo candidates">
                        {real.map((o, j) => (
                          <button key={o.url} className={`idk-opt${j === pickIdx ? " is-sel" : ""}`}
                            title={o.attribution ?? o.source}
                            aria-label={`Candidate ${j + 1} of ${real.length} (${o.source})`}
                            onClick={() => setPicks((p) => ({ ...p, [row.id]: j }))}>
                            <img src={o.url} alt="" loading="lazy" />
                          </button>
                        ))}
                      </div>
                    ) : null}

                    {selected?.attribution ? <p className="catphoto-attr">{selected.attribution}</p> : null}

                    <div className="actions pt">
                      <button className="btn btn-approve btn-sm" disabled={!selected || busyId === row.id}
                        onClick={() => applySelected(row)}>
                        Use selected <span className="k">A</span>
                      </button>
                      <button className="btn btn-edit btn-sm" disabled={searching} onClick={() => doFreeSearch(row)}>
                        {searching ? "Searching…" : "Search free"} <span className="k">F</span>
                      </button>
                      <button className="btn btn-edit btn-sm" disabled={searching} onClick={() => doGoogleFetch(row)}>
                        Google ($) <span className="k">G</span>
                      </button>
                      <button className="btn btn-edit btn-sm" disabled={busyId === row.id || autoRunning} onClick={() => autoGoogleOne(row)}>
                        Google auto ($) <span className="k">⇧G</span>
                      </button>
                      <button className="btn btn-quiet btn-sm" disabled={busyId === row.id} onClick={() => ackAsIs(row)}>
                        Looks right as-is <span className="k">M</span>
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })
        )}

        {totalPages > 1 ? (
          <div className="pager">
            <button disabled={pageClamped <= 1} onClick={() => { setPage(pageClamped - 1); setActive(0); }}>← Prev</button>
            <span>Page {pageClamped} of {totalPages}</span>
            <button disabled={pageClamped >= totalPages} onClick={() => { setPage(pageClamped + 1); setActive(0); }}>Next →</button>
          </div>
        ) : null}
      </main>

      <aside className="side">
        <div className="panel">
          <h3>Shortcuts</h3>
          <div className="keys">
            <div className="kr"><span className="kk">↑↓</span> Move between cards</div>
            <div className="kr"><span className="kk">←→</span> Browse candidates</div>
            <div className="kr"><span className="kk">A</span> Apply the selected candidate</div>
            <div className="kr"><span className="kk">W</span> Apply the top-ranked candidate</div>
            <div className="kr"><span className="kk">V</span> Attach the suggested venue</div>
            <div className="kr"><span className="kk">F</span> Search free (Wikimedia)</div>
            <div className="kr"><span className="kk">G</span> Fetch via Google (paid, review)</div>
            <div className="kr"><span className="kk">⇧G</span> Google top photo, auto-applied</div>
            <div className="kr"><span className="kk">M</span> Looks right as-is (dismiss)</div>
          </div>
        </div>
        <div className="panel">
          <h3>How this desk works</h3>
          <div className="keys">
            <div className="kr">Free Wikimedia candidates pre-load in the background as you page, browsing costs nothing.</div>
            <div className="kr">Attaching a venue with approved photos assigns one instantly ($0) and keeps it auto-refreshed.</div>
            <div className="kr">Google is the only paid step and always an explicit press, counted on the budget chip.</div>
            <div className="kr">Auto-assign only acts on exact/strong venue matches and gate-passing Wikimedia picks, everything it does lands in the strip with one-click revert.</div>
            <div className="kr">Auto-Google is the paid second pass: only the top photo per item (~1 billable call), auto-approved into the venue pool; items with no confident place match are skipped, never guessed.</div>
            <div className="kr">&ldquo;Venue pools to build&rdquo; is the multiplier, one approved photo covers every queue item at that venue. Work it top-down before spending on Google.</div>
            <div className="kr">&ldquo;Keep motif (view)&rdquo; is the honest tail: dated events with no address are MEANT to sit on the motif, filter to them and dismiss the lot.</div>
          </div>
        </div>
        <div className="panel">
          <h3>Queue</h3>
          <div className="keys">
            <div className="kr"><span className="kk">{rows.length}</span> without a real image</div>
            <div className="kr"><span className="kk">{assigned.length}</span> assigned this session</div>
            <div className="kr">
              Catalog coverage:&nbsp;
              <b>{publishedTotal ? Math.round(((publishedTotal - noImageTotal) / publishedTotal) * 100) : 0}%</b>
              &nbsp;real images ({noImageTotal} of {publishedTotal} published lack one)
            </div>
            <div className="kr">
              <button className="btn btn-edit btn-sm" onClick={refresh} disabled={refreshing}>
                {refreshing ? "Refreshing…" : "↻ Refresh list"}
              </button>
            </div>
          </div>
        </div>
      </aside>

      {toast ? (
        <div className="toast show" role="status">
          {toast.msg}
          {toast.undo ? <span className="undo" onClick={toast.undo} role="button" tabIndex={0}>Undo</span> : null}
        </div>
      ) : null}
    </div>
  );
}
