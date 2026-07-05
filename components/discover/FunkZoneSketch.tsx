// Funk Zone sketch map — base SVG without marker circles.
// Markers are rendered as an overlay layer in GuideWalkSection so Phase 3
// can recolor them per-stop without touching this asset.
// Lifted from SBDaymaker_DiscoverSB_Mockup_v5.html Frame 01 as drawn.
// All colors use v9 CSS token variables — zero hardcoded hex.

export function FunkZoneSketch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 330"
      role="img"
      aria-label="Hand-drawn sketch map of the Funk Zone"
      className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {/* base */}
      <rect x="0" y="0" width="360" height="330" fill="var(--paper)" />

      {/* train tracks */}
      <g stroke="var(--ink-2)" strokeWidth="1.6" strokeLinecap="round">
        <path d="M8 40 C 90 32, 240 26, 352 30" fill="none" />
        <path d="M8 47 C 90 39, 240 33, 352 37" fill="none" />
      </g>
      <g stroke="var(--ink-2)" strokeWidth="1.4">
        <path d="M30 37l-1 9M60 35l-1 9M90 33l-1 9M120 32l-1 9M150 31l-1 9M180 30l-1 9M210 29l-1 9M240 29l-1 9M270 29l-1 9M300 29l-1 9M330 30l-1 9" />
      </g>
      <text
        x="255"
        y="22"
        fontFamily="var(--font-mono)"
        fontSize="8.5"
        fontWeight="700"
        fill="var(--ink-2)"
        letterSpacing="1.5"
      >
        THE TRACKS
      </text>

      {/* streets */}
      <g stroke="var(--ink)" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M46 52 C 44 120, 45 190, 47 252 C 40 268, 30 284, 20 300" />
        <path d="M96 58 C 95 120, 96 190, 95 250" />
        <path d="M152 54 C 151 120, 152 190, 151 250" />
        <path d="M216 52 C 215 120, 216 190, 215 249" />
        <path d="M282 51 C 281 120, 282 190, 281 248" />
        <path d="M30 118 C 120 116, 250 117, 340 115" />
        <path d="M30 186 C 120 184, 250 185, 340 183" />
        <path d="M8 256 C 100 250, 250 250, 352 244" strokeWidth="2.4" />
      </g>

      {/* street labels */}
      <g
        fontFamily="var(--font-mono)"
        fontSize="8"
        fontWeight="700"
        fill="var(--ink-2)"
        letterSpacing="1"
      >
        <text x="52" y="86" transform="rotate(89 52 86)">STATE ST</text>
        <text x="101" y="215" transform="rotate(89 101 215)">HELENA</text>
        <text x="157" y="63" transform="rotate(89 157 63)">ANACAPA ST</text>
        <text x="221" y="196" transform="rotate(89 221 196)">SANTA BARBARA ST</text>
        <text x="287" y="70" transform="rotate(89 287 70)">GARDEN</text>
        <text x="236" y="111">YANONALI ST</text>
        <text x="100" y="179">MASON ST</text>
        <text x="192" y="240">CABRILLO BLVD</text>
      </g>

      {/* coastline */}
      <g stroke="var(--pacific)" strokeWidth="1.8" strokeLinecap="round" fill="none">
        <path d="M14 288 q10 -7 20 0 t20 0 t20 0" />
        <path d="M120 300 q10 -7 20 0 t20 0 t20 0 t20 0" />
        <path d="M250 292 q10 -7 20 0 t20 0" />
        <path d="M60 316 q10 -7 20 0 t20 0" />
      </g>
      <text
        x="222"
        y="322"
        fontFamily="var(--font-display)"
        fontStyle="italic"
        fontSize="13"
        fill="var(--pacific)"
        letterSpacing="3"
      >
        the Pacific
      </text>

      {/* railway siding → Stearns Wharf */}
      <g stroke="var(--ink-2)" strokeWidth="1.8" strokeLinecap="round">
        <path d="M20 300 L 42 326" />
        <path d="M25 303l4-4M31 310l4-4M37 317l4-4" />
      </g>
      <text
        x="8"
        y="278"
        fontFamily="var(--font-mono)"
        fontSize="7.5"
        fontWeight="700"
        fill="var(--ink-2)"
        transform="rotate(48 8 278)"
      >
        STEARNS WHARF →
      </text>

      {/* route (terracotta dashes) */}
      <path
        d="M96 130 C 96 100, 96 76, 88 66 C 78 58, 62 60, 54 66 C 48 90, 47 150, 48 186 L 88 190 C 110 190, 140 190, 148 172 C 154 150, 150 128, 152 112 C 162 106, 176 112, 182 122 C 178 136, 162 140, 158 152 C 154 166, 148 176, 143 180 C 152 186, 160 186, 167 186 C 163 210, 158 236, 155 252 C 154 266, 153 276, 152 288"
        fill="none"
        stroke="var(--terracotta)"
        strokeWidth="2"
        strokeDasharray="1.5 6"
        strokeLinecap="round"
        opacity=".85"
      />

      {/* ✵ secret mark */}
      <text
        x="126"
        y="177"
        fontFamily="var(--font-display)"
        fontSize="11.5"
        fontWeight="700"
        fill="var(--gold-text)"
      >
        ✵
      </text>

      {/* THE FUNK ZONE plate */}
      <g transform="translate(268,158) rotate(-7)">
        <rect
          x="-52"
          y="-16"
          width="104"
          height="32"
          rx="5"
          fill="none"
          stroke="var(--terra-text)"
          strokeWidth="1.6"
        />
        <rect
          x="-48"
          y="-12"
          width="96"
          height="24"
          rx="3"
          fill="none"
          stroke="var(--terra-text)"
          strokeWidth=".8"
          strokeDasharray="3 3"
        />
        <text
          x="0"
          y="4.5"
          textAnchor="middle"
          fontFamily="var(--font-display)"
          fontWeight="900"
          fontSize="12.5"
          fill="var(--terra-text)"
          letterSpacing="2.5"
        >
          THE FUNK ZONE
        </text>
      </g>

      {/* compass */}
      <g transform="translate(322,285)">
        <circle r="14" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" />
        <path d="M0 -9 L3 3 L0 1 L-3 3 Z" fill="var(--terracotta)" />
        <text
          x="0"
          y="-17"
          textAnchor="middle"
          fontFamily="var(--font-mono)"
          fontSize="8"
          fontWeight="700"
          fill="var(--ink-2)"
        >
          N
        </text>
      </g>
    </svg>
  );
}
