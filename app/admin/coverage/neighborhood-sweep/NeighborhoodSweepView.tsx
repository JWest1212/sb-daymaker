"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import type { SweepSummary, DictionaryEntry, SweepTriageItem } from "@/lib/neighborhoodSweep";
import { DOOR_ZONES, DOOR_ZONE_BY_KEY, type DoorZoneKey } from "@/lib/doorZones";

const METHOD_LABEL: Record<string, string> = {
  place_id: "Venue dictionary (place ID)",
  venue_name: "Venue dictionary (name match)",
  source: "Source-implied venue",
  point_in_polygon: "Coordinates (in zone)",
  street: "Address / street",
  existing: "Already had a zone",
  unresolved: "Unresolved",
};

const CHIP_LABEL: Record<DoorZoneKey | "other", string> = {
  downtown_state: "Downtown",
  funk_zone: "Funk Zone",
  waterfront_harbor: "Waterfront",
  mesa: "The Mesa",
  mission_riviera: "Mission/Riviera",
  uptown_upper_state: "Uptown",
  goleta_isla_vista: "Goleta/IV",
  montecito_carpinteria: "Montecito+",
  other: "Regional / Online",
};

const CHIP_ORDER: (DoorZoneKey | "other")[] = [...DOOR_ZONES.map((z) => z.key), "other"];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  });
}

function TriageRow({
  item, pending, assignedTo, onAssign,
}: {
  item: SweepTriageItem;
  pending: boolean;
  assignedTo: string | null;
  onAssign: (zoneKey: DoorZoneKey | "other") => void;
}) {
  return (
    <div className="sweep-titem">
      <div className="tt">{item.title}</div>
      <div className="meta">
        {item.venueNameGuess ? <span>venue <b>{item.venueNameGuess}</b></span> : null}
        {item.address ? <span>addr <b>{item.address}</b></span> : null}
        {item.source ? <span>src <b>{item.source}</b></span> : null}
      </div>
      {item.suggestedZone ? (
        <div className="sweep-suggest">
          <span className="conf">{item.confidence.toFixed(2)}</span>
          suggested from {METHOD_LABEL[item.method]?.toLowerCase() ?? item.method}:
          <span className="zpill">{DOOR_ZONE_BY_KEY[item.suggestedZone].label}</span>
        </div>
      ) : (
        <div className="sweep-nosuggest">No signal found — no venue match, no source hint, no coordinates, no street match.</div>
      )}

      {assignedTo ? (
        <div className="sweep-assigned">&#10003; Assigned to {assignedTo}.</div>
      ) : (
        <div className="sweep-chips" role="group" aria-label="Assign a zone">
          {CHIP_ORDER.map((key) => (
            <button
              key={key}
              type="button"
              className={`sweep-chip${item.suggestedZone === key ? " suggested" : ""}${key === "other" ? " other" : ""}`}
              disabled={pending}
              onClick={() => onAssign(key)}
            >
              {CHIP_LABEL[key]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function NeighborhoodSweepView({
  initialSummary,
  initialDictionary,
}: {
  initialSummary: SweepSummary;
  initialDictionary: DictionaryEntry[];
}) {
  const [summary, setSummary] = useState(initialSummary);
  const [dictionary, setDictionary] = useState(initialDictionary);
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [assignedMap, setAssignedMap] = useState<Record<string, string>>({});
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [venueName, setVenueName] = useState("");
  const [venueZone, setVenueZone] = useState("");
  const [addingVenue, setAddingVenue] = useState(false);

  const showToast = useCallback((m: string) => {
    setToast(m);
    setTimeout(() => setToast(null), 4000);
  }, []);

  const runSweep = useCallback(async () => {
    setLoading(true);
    const res: SweepSummary | null = await fetch("/api/admin/coverage/neighborhood-sweep")
      .then((r) => r.json()).catch(() => null);
    setLoading(false);
    if (res) { setSummary(res); setAssignedMap({}); }
  }, []);

  const refreshDictionary = useCallback(async () => {
    const res = await fetch("/api/admin/coverage/neighborhood-sweep/dictionary").then((r) => r.json()).catch(() => null);
    if (res?.venues) setDictionary(res.venues);
  }, []);

  const applyResolved = useCallback(async () => {
    setApplying(true);
    const res = await fetch("/api/admin/coverage/neighborhood-sweep/apply", { method: "POST" })
      .then((r) => r.json()).catch(() => null);
    setApplying(false);
    if (res) {
      showToast(`Applied: ${res.updated} thing${res.updated === 1 ? "" : "s"} moved out of other/null. ${res.remaining} still need${res.remaining === 1 ? "s" : ""} triage.`);
      runSweep();
    } else {
      showToast("Apply failed — check the console.");
    }
  }, [runSweep, showToast]);

  const assignTriage = useCallback(async (item: SweepTriageItem, zoneKey: DoorZoneKey | "other") => {
    setPendingId(item.id);
    const res = await fetch("/api/admin/coverage/neighborhood-sweep/triage", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id: item.id, zoneKey, venueName: zoneKey !== "other" ? item.venueNameGuess : null }),
    }).then((r) => r.json()).catch(() => null);
    setPendingId(null);
    if (res?.ok) {
      setAssignedMap((m) => ({ ...m, [item.id]: CHIP_LABEL[zoneKey] }));
      if (res.addedToDictionary) { showToast(`Assigned. Added ${item.venueNameGuess} to the dictionary.`); refreshDictionary(); }
      else showToast("Assigned.");
    } else {
      showToast(res?.error ? `Assign failed: ${res.error}` : "Assign failed.");
    }
  }, [showToast, refreshDictionary]);

  const addVenue = useCallback(async () => {
    if (!venueName.trim() || !venueZone) return;
    setAddingVenue(true);
    const res = await fetch("/api/admin/coverage/neighborhood-sweep/dictionary", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: venueName.trim(), zoneKey: venueZone }),
    }).then((r) => r.json()).catch(() => null);
    setAddingVenue(false);
    if (res?.ok) {
      setVenueName(""); setVenueZone("");
      showToast(`Added ${venueName.trim()} to the dictionary.`);
      refreshDictionary();
    } else {
      showToast(res?.error ? `Add failed: ${res.error}` : "Add failed.");
    }
  }, [venueName, venueZone, showToast, refreshDictionary]);

  const maxMethod = Math.max(1, ...summary.byMethod.map((m) => m.count));
  const maxZone = Math.max(1, ...summary.byZone.map((z) => z.count));
  const sortedZones = [...summary.byZone].sort((a, b) => a.count - b.count);
  const thinKeys = new Set(sortedZones.filter((z) => z.count > 0).slice(0, 2).map((z) => z.key));
  const thinLabels = sortedZones.filter((z) => thinKeys.has(z.key)).map((z) => z.label);

  const openTriage = useMemo(() => summary.triage.filter((t) => !assignedMap[t.id]), [summary.triage, assignedMap]);
  const closedTriage = useMemo(() => summary.triage.filter((t) => assignedMap[t.id]), [summary.triage, assignedMap]);
  const streetSuggested = openTriage.filter((t) => t.method === "street");
  const noSuggestion = openTriage.filter((t) => t.method !== "street");

  return (
    <div className="wrap" style={{ display: "block", maxWidth: 960 }}>
      <div className="sweep-head">
        <Link href="/admin/coverage" style={{ fontSize: ".78rem", color: "var(--pacific)" }}>&larr; Coverage</Link>
        <h1 className="qtitle" style={{ marginTop: 6 }}>Neighborhood Sweep</h1>
        <p className="sub">
          Make sure every published thing lands in a real zone, so nothing that is actually in Santa
          Barbara falls into &quot;other,&quot; where the Place door cannot see it.
        </p>
        <div className="sweep-runrow">
          <button className="btn btn-approve" onClick={runSweep} disabled={loading}>
            {loading ? "Running…" : "Run sweep (dry run)"}
          </button>
          <button className="btn btn-edit" onClick={applyResolved} disabled={applying || summary.resolved === 0}>
            {applying ? "Applying…" : "Apply resolved →"}
          </button>
          <span className="sweep-laststamp">last run: {fmtTime(summary.generatedAt)}</span>
        </div>
      </div>

      {/* A · SUMMARY */}
      <section className="card">
        <div className="sweep-body">
          <span className="sweep-kicker">Step 1 &middot; Measure the gap</span>
          <h2>What the resolver found</h2>
          <p className="sub">Counts across the {summary.total} published things.</p>

          <div className="sweep-stat4">
            <div className="sweep-stat good"><div className="n">{summary.resolved}</div><div className="l">resolved to a zone</div></div>
            <div className="sweep-stat flag"><div className="n">{summary.unresolved}</div><div className="l">unresolved &rarr; triage</div></div>
            <div className="sweep-stat"><div className="n">{Math.round(summary.autoResolveRate * 100)}%</div><div className="l">auto-resolve rate</div></div>
            <div className="sweep-stat"><div className="n">$0</div><div className="l">API cost (no geocoding)</div></div>
          </div>

          <div className="sweep-waterfall" aria-label="Resolution by method">
            {summary.byMethod.map((m) => (
              <div className={`sweep-wrow${m.method === "unresolved" ? " is-unresolved" : ""}`} key={m.method}>
                <span className="wk">{METHOD_LABEL[m.method] ?? m.method}</span>
                <span className="wbar"><i style={{ width: `${(m.count / maxMethod) * 100}%` }} /></span>
                <span className="wn">{m.count}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 18 }}>
            <span className="sweep-kicker">Distribution across the 8 door-zones (resolved things)</span>
            <div className="sweep-zonedist" style={{ marginTop: 8 }}>
              {[...summary.byZone].sort((a, b) => b.count - a.count).map((z) => (
                <div className={`sweep-zrow${thinKeys.has(z.key) ? " thin" : ""}`} key={z.key}>
                  <span className="zk">{z.label}</span>
                  <span className="zbar"><i style={{ width: `${(z.count / maxZone) * 100}%` }} /></span>
                  <span className="zn">{z.count}</span>
                </div>
              ))}
            </div>
            {thinLabels.length > 0 ? (
              <p className="sweep-thinnote">
                {thinLabels.join(" and ")} {thinLabels.length > 1 ? "are" : "is"} the thinnest zone
                {thinLabels.length > 1 ? "s" : ""} right now — this feeds the source-targeting work,
                not the sweep, flagged here so it&apos;s visible from day one.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* B · TRIAGE */}
      <section className="card sweep-triage-card">
        <div className="sweep-body">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
            <div>
              <span className="sweep-kicker" style={{ color: "var(--terra-text)" }}>Step 2 &middot; Place the residue</span>
              <h2 style={{ marginTop: 2 }}>Triage queue</h2>
            </div>
            <span className="sweep-tcount">{openTriage.length} to place</span>
          </div>
          <p className="sub">
            Things the resolver could not place with confidence. One tap assigns a zone; the suggested
            chip is pre-highlighted.
          </p>

          {summary.triage.length === 0 ? (
            <p className="sub" style={{ marginBottom: 0 }}>Nothing to triage — every published thing resolved.</p>
          ) : (
            <>
              {streetSuggested.slice(0, 25).map((t) => (
                <TriageRow key={t.id} item={t} pending={pendingId === t.id} assignedTo={null} onAssign={(z) => assignTriage(t, z)} />
              ))}
              {noSuggestion.slice(0, 25).map((t) => (
                <TriageRow key={t.id} item={t} pending={pendingId === t.id} assignedTo={null} onAssign={(z) => assignTriage(t, z)} />
              ))}
              {closedTriage.map((t) => (
                <TriageRow key={t.id} item={t} pending={false} assignedTo={assignedMap[t.id]} onAssign={() => {}} />
              ))}
              {(() => {
                const shown = Math.min(streetSuggested.length, 25) + Math.min(noSuggestion.length, 25);
                return shown < openTriage.length ? (
                  <p className="sweep-morenote">Showing {shown} of {openTriage.length} still open. Assign a few, then Run sweep again to page through the rest.</p>
                ) : null;
              })()}
            </>
          )}
        </div>
      </section>

      {/* C · DICTIONARY */}
      <section className="card">
        <div className="sweep-body">
          <span className="sweep-kicker">Step 3 &middot; The reusable asset</span>
          <h2>Venue dictionary</h2>
          <p className="sub">
            Your local knowledge, encoded once. Venue name maps to zone, no API, no cost. This is also
            the seed of the venue-attribute registry that Dog Friendly and later accessibility / patio /
            parking reuse.
          </p>

          <table className="sweep-dtable">
            <thead><tr><th>Venue</th><th>Zone</th><th>Source</th></tr></thead>
            <tbody>
              {dictionary.map((v) => (
                <tr key={v.name}>
                  <td>
                    <div className="venue">{v.name}</div>
                    {v.aliases.length > 0 ? <div className="aliases">aka {v.aliases.join(", ")}</div> : null}
                  </td>
                  <td><span className="zpill">{v.zoneLabel}</span></td>
                  <td><span className={`src${v.createdBy === "founder" ? " founder" : ""}`}>{v.createdBy}</span></td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="sweep-addrow">
            <input
              type="text" placeholder="Add a venue (e.g. Carpinteria Arts Center)" aria-label="Venue name"
              value={venueName} onChange={(e) => setVenueName(e.target.value)}
            />
            <select aria-label="Zone" value={venueZone} onChange={(e) => setVenueZone(e.target.value)}>
              <option value="">Pick a zone</option>
              {DOOR_ZONES.map((z) => <option key={z.key} value={z.key}>{z.label}</option>)}
            </select>
            <button className="btn btn-edit" onClick={addVenue} disabled={addingVenue || !venueName.trim() || !venueZone}>
              {addingVenue ? "Adding…" : "Add"}
            </button>
          </div>
          <div className="sweep-selfheal">
            <b>Self-healing.</b> Once folded into the nightly land step, every new thing gets a zone
            automatically. A brand-new venue is a one-time add here, then it is solved forever.
          </div>
        </div>
      </section>

      {toast ? <div className="toast show" role="status">{toast}</div> : null}
    </div>
  );
}
