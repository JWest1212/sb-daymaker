import type { SourceRow } from "@/lib/review";

const LABEL: Record<string, string> = {
  ticketmaster: "Ticketmaster API",
  soho: "SOhO ticketing",
  sbbowl: "Santa Barbara Bowl",
  lobero: "Lobero Theatre",
  // Wave 2 venue-direct
  granada: "The Granada Theatre",
  arlington: "Arlington Theatre",
  musicacademy: "Music Academy of the West",
  alcazar: "The Alcazar Theater",
  // Wave 2 institutions
  moxi: "MOXI Museum",
  naturalHistory: "SB Museum of Natural History",
  botanicGarden: "SB Botanic Garden",
  sbma: "SB Museum of Art",
  // Wave 2 civic / curated
  goletaCivic: "City of Goleta",
  carpinteriaCivic: "City of Carpinteria",
  downtownSB: "Downtown Santa Barbara",
  // pre-Wave 2
  independent: "The Independent",
  citysb: "City of Santa Barbara",
  ucsb: "UCSB Campus Events",
  libraries: "SB Public Library",
  farmersMarkets: "SB Farmers Markets",
  registry: "Recurring registry",
  submission: "Public submissions",
  visitsb: "Visit Santa Barbara",
  google_places: "Google Places",
  livenotes: "LiveNotes SB",
};

/** Source-health panel — latest run per source, green/amber/red (Doc 11 §9). */
export function SourceHealth({ sources }: { sources: SourceRow[] }) {
  return (
    <div className="panel">
      <h3>Source health</h3>
      <div className="sources">
        {sources.length === 0 ? (
          <div className="srcrow"><span className="sname">No runs yet.</span></div>
        ) : (
          sources.map((s) => (
            <div className={`srcrow ${s.status}`} key={s.source}>
              <span className="sdot" />
              <span className="sname">{LABEL[s.source] ?? s.source}</span>
              <span className="scount">
                {s.status === "fail" ? "0 — down" : s.status === "warn" ? "refresh" : `${s.landed} new`}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
