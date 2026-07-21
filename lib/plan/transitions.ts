// Gate 4 · G4.4, transition + parking annotation. Between two consecutive stops,
// compute a realistic walk/drive estimate and attach the zone's parking truth
// once (at the first hop that lands in a parkable zone). Pure, deterministic,
// no routing API. No em dash (Golden Rule).

import type { Thing } from "@/lib/things";
import type { Stop, Transition, ResolvedParams } from "./types";
import { hopBetween, type Point } from "./zoneGraph";
import { parkingNote } from "./parkingByZone";

function pointOf(t: Thing): Point {
  return { lat: t.lat, lng: t.lng, zone: t.nearby_zone };
}

/** "4 min walk" / "8 min drive". */
function hopLabel(mode: "walk" | "drive", minutes: number): string {
  return `${minutes} min ${mode}`;
}

/**
 * Build the transition line rendered ABOVE each stop after the first. The parking
 * note is stated once, at the first hop whose destination sits in a zone we have
 * parking truth for (a car day states "park once ...; forget the car"). Pure.
 */
export function annotateTransitions(
  stops: Stop[],
  thingMap: Map<string, Thing>,
  params: ResolvedParams,
): Transition[] {
  const out: Transition[] = [];
  let parkingStated = false;

  for (let i = 1; i < stops.length; i++) {
    const prev = thingMap.get(stops[i - 1].thingId);
    const cur = thingMap.get(stops[i].thingId);
    if (!prev || !cur) continue;

    const hop = hopBetween(pointOf(prev), pointOf(cur), params.transport);
    let note: string | null = null;

    // State parking once. On a car day, tie it to the destination zone; on a walk
    // day, still surface the "park once" truth for the anchor zone at the first hop.
    if (!parkingStated) {
      const zoneForNote = cur.nearby_zone ?? prev.nearby_zone ?? params.zone;
      const raw = parkingNote(zoneForNote);
      if (raw) {
        note = params.transport === "walk" ? raw : `${raw}`;
        parkingStated = true;
      }
    }

    out.push({
      beforeStopId: stops[i].id,
      mode: hop.mode,
      minutes: hop.minutes,
      label: note ? `${hopLabel(hop.mode, hop.minutes)} · ${note}` : hopLabel(hop.mode, hop.minutes),
      parkingNote: note,
    });
  }

  return out;
}
