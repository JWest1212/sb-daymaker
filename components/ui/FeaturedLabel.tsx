// Elevation v1 · Gate 5 · G5.7, the labeled-placement seam (inert this build).
//
// A clearly-labeled, structurally-separate "Featured" badge for the future paid
// placement line. It is wired to NOTHING: no ranker reads is_featured/sponsor_id
// (CLAUDE.md §2.8, proven by lib/explore.test.ts + lib/tiles.test.ts), and nothing
// renders this component yet. When labeled placement ships, render it on a slot
// that is chosen OUTSIDE the ranker, so curation is never corrupted by money.
// No em dash (Golden Rule).

export function FeaturedLabel({ className }: { className?: string }) {
  return (
    <span className={`sbd-featured-label${className ? ` ${className}` : ""}`} aria-label="Featured placement">
      Featured
    </span>
  );
}
