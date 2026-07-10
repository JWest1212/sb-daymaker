// components/visuals/SvgDefs.tsx
//
// Card Imagery Build Spec Phase 3 §6.2 — the shared filter/symbol defs behind
// every motif, ported verbatim from
// docs/card-imagery/SBDaymaker_Explore_Feed_Mockup_v1.html (`#grain`, `#vig`,
// `#tremble`, `#tremble2`, `#peli`), renamed with an `sbd-` prefix so they can't
// collide with anything else in the app. Mounted EXACTLY ONCE, in the root layout
// — a feed renders many `ListCard`s, and duplicating `<filter id="sbd-grain">`
// once per card would collide on id and (per the SVG spec) make every reference
// after the first resolve to nothing.

export function SvgDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden="true">
      <defs>
        <filter id="sbd-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency={0.7}
            numOctaves={2}
            seed={7}
            stitchTiles="stitch"
            result="n"
          />
          <feColorMatrix
            in="n"
            type="matrix"
            values="0 0 0 0 0.17  0 0 0 0 0.13  0 0 0 0 0.10  0 0 0 0.7 0"
          />
        </filter>
        <radialGradient id="sbd-vig" cx="50%" cy="46%" r="72%">
          <stop offset="78%" stopColor="#3a2a1a" stopOpacity={0} />
          <stop offset="100%" stopColor="#3a2a1a" stopOpacity={0.05} />
        </radialGradient>
        <filter id="sbd-tremble" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency={0.012} numOctaves={2} seed={3} result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale={2.3} />
        </filter>
        <filter id="sbd-tremble2" x="-6%" y="-6%" width="112%" height="112%">
          <feTurbulence type="fractalNoise" baseFrequency={0.014} numOctaves={2} seed={8} result="w" />
          <feDisplacementMap in="SourceGraphic" in2="w" scale={2.2} />
        </filter>
        <symbol id="sbd-peli" viewBox="0 0 20 16">
          <path d="M0 7.3 6.8 3.6Q7.2 1.3 9.4 1q2.4-.2 3.3 1.9 3.8.1 5.6 2.7 1.6 2.6-.2 5.2-2 2.5-5.7 2.3-3.2-.2-4.7-2.4-1.7.6-3-.3l1.6-.9Q3.1 9.7 1.2 8.3.4 7.8 0 7.3z" />
          <path d="M10.9 13.1h1V16h-1zM13.7 13h1v2.9h-1z" />
          <circle cx="9.5" cy="3.2" r={0.6} fill="#FCFAF5" />
        </symbol>
      </defs>
    </svg>
  );
}
