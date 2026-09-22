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
  const byType = (pool: Thing[]) =>
    ORDER.map((o) => ({
      key: o.type,
      label: o.label,
      dot: o.dot,
      items: pool.filter((t) => t.type === o.type),
    })).filter((g) => g.items.length > 0);

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
