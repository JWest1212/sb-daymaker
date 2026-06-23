import type { Thing, ThingType } from "./things";

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

/** Group saved things by type, in a sensible reading order; drop empty groups. */
export function groupSaved(things: Thing[]): SavedGroup[] {
  return ORDER.map((o) => ({
    key: o.type,
    label: o.label,
    dot: o.dot,
    items: things.filter((t) => t.type === o.type),
  })).filter((g) => g.items.length > 0);
}
