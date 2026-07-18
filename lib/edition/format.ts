// lib/edition/format.ts, small display-formatting helpers shared by the
// drafter (copy tokens) and the renderer (locator text).

/** "funk_zone" -> "Funk Zone". Snake-case enum value -> display label. */
export function titleCaseNeighborhood(snake: string): string {
  return snake.split("_").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
}
