import type { Thing, ThingType } from "./things";
import { areaForThing, type AreaKey } from "./areas";

export interface SavedGroup {
  key: string;
  label: string;
  dot: string; // token color var
  items: Thing[];
}

const ORDER: { type: ThingType; label: string; dot: string }[] = [
  { type: "event", label: "Events", dot: "var(--terracotta)" },
  { type: "happyhour", label: "Happy Hours", dot: "var(--gold)" },
  { type: "firstlook", label: "First Looks", dot: "var(--purple)" },
  { type: "place", label: "Places", dot: "var(--forest)" },
];

/** R1 W7.2. Anything with no start time: evergreen places and recurring
 *  regulars alike. A weekly swim or a standing happy hour is not "an event you
 *  might miss", it is somewhere you can go; it belongs with the places. */
export const REGULARS_LABEL = "Places and regulars";
export function isRegular(t: Thing): boolean {
  return !t.starts_at;
}

/**
 * Group saved things by type, in a sensible reading order; drop empty groups.
 *
 * R1 W4.3. When the visitor picks an area, that area gets its OWN group at the
 * top instead. Grouping by type and ordering by area are in direct conflict:
 * `nearMeSort` bubbles the matches to the front of the array, and then grouping
 * by type scatters them back through Events, Places and Happy Hours, so the
 * visitor taps Near Me and sees nothing move (TP-A2-05). A named group is a
 * visible answer, and it says which area it is answering about.
 */
export function groupSaved(things: Thing[], area?: { key: AreaKey; label: string } | null): SavedGroup[] {
  // R1 W7.2. Dated things keep their type groups; everything undated, whatever
  // its type, gathers under "Places and regulars" at the end.
  const byType = (pool: Thing[]) => {
    const dated = pool.filter((t) => !isRegular(t));
    const regulars = pool.filter(isRegular);
    const groups: SavedGroup[] = ORDER.map((o) => ({
      key: o.type as string,
      label: o.label,
      dot: o.dot,
      items: dated.filter((t) => t.type === o.type),
    })).filter((g) => g.items.length > 0);
    if (regulars.length > 0) {
      groups.push({ key: "regulars", label: REGULARS_LABEL, dot: "var(--forest)", items: regulars });
    }
    return groups;
  };

  if (!area) return byType(things);

  const inArea = things.filter((t) => areaForThing(t) === area.key);
  const rest = things.filter((t) => areaForThing(t) !== area.key);
  const groups: SavedGroup[] = [];
  if (inArea.length > 0) {
    groups.push({ key: `area:${area.key}`, label: `In ${area.label}`, dot: "var(--pacific)", items: inArea });
  }
  // Everything else keeps its normal type grouping, below the chosen area.
  groups.push(...byType(rest));
  return groups;
}
