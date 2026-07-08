// State Street sketch map — base SVG without marker circles.
// Markers are rendered as an overlay layer in GuideWalkSection so Phase 3
// can recolor them per-stop without touching this asset.
// Lifted from State_Street_Guide_Mockup_v8.html as drawn.
// All colors use v9 CSS token variables — zero hardcoded hex.

export function StateStreetSketch({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 360 330"
      role="img"
      aria-label="Hand-drawn sketch map of State Street, from the upper theaters down to the old Presidio"
      className={className}
      style={{ display: "block", width: "100%", height: "auto" }}
    >
      {/* base */}
      <rect x="0" y="0" width="360" height="330" fill="var(--paper)" />

      {/* mountains */}
      <g fill="none" stroke="var(--sage)" strokeWidth="1.3" strokeLinecap="round">
        <path d="M4 34 C 44 20, 66 18, 96 28 C 128 16, 158 24, 190 14 C 224 24, 252 17, 286 27 C 316 19, 340 24, 356 20" />
        <path d="M150 26 C 190 32, 230 26, 270 32 M300 24 C 320 28, 340 26, 356 30" opacity=".5" />
      </g>
      <text x="252" y="14" fontFamily="var(--font-display)" fontStyle="italic" fontSize="11" fill="var(--sage-text)">
        the mountains
      </text>

      {/* cross streets (light background grid) */}
      <g stroke="var(--ink-2)" strokeWidth="1" strokeLinecap="round" fill="none" opacity=".4">
        <path d="M58 82 C 130 81, 200 82, 260 81" />
        <path d="M58 124 C 130 123, 200 124, 260 123" />
        <path d="M58 150 C 130 149, 200 150, 260 149" />
        <path d="M58 212 C 130 211, 200 212, 262 211" />
        <path d="M58 260 C 130 259, 200 260, 262 259" />
      </g>

      {/* verticals */}
      <g stroke="var(--ink)" strokeLinecap="round" fill="none">
        <path d="M152 46 C 150 120, 160 200, 170 292" strokeWidth="2.6" />
        <path d="M152 46 C 150 120, 160 200, 170 292" stroke="var(--plaster)" strokeWidth=".8" strokeDasharray="2 6" />
        <path d="M260 64 C 260 140, 261 220, 262 284" strokeWidth="1.2" opacity=".55" />
        <path d="M58 64 C 58 140, 57 220, 56 284" strokeWidth="1.2" opacity=".55" />
      </g>

      {/* street labels */}
      <g fontFamily="var(--font-mono)" fontSize="7" fontWeight="700" fill="var(--ink-2)" letterSpacing=".5" opacity=".8">
        <text x="160" y="176" transform="rotate(88 160 176)">STATE ST</text>
        <text x="266" y="72" transform="rotate(88 266 72)">ANACAPA</text>
        <text x="52" y="126" transform="rotate(88 52 126)">CHAPALA</text>
        <text x="8" y="79">VICTORIA</text>
        <text x="8" y="121">ANAPAMU</text>
        <text x="8" y="147">FIGUEROA</text>
        <text x="8" y="209">CANON PERDIDO</text>
        <text x="8" y="257">ORTEGA</text>
      </g>

      {/* palms */}
      <g>
        <path d="M98 190 Q100 182 98 174" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" strokeLinecap="round" />
        <g fill="none" stroke="var(--sage)" strokeWidth="1.3" strokeLinecap="round">
          <path d="M98 174 q-9 -1 -13 4" />
          <path d="M98 174 q-6 -6 -12 -6" />
          <path d="M98 174 q0 -6 0 -9" />
          <path d="M98 174 q6 -6 12 -6" />
          <path d="M98 174 q9 -1 13 4" />
        </g>
      </g>
      <g>
        <path d="M198 192 Q200 184 198 176" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" strokeLinecap="round" />
        <g fill="none" stroke="var(--sage)" strokeWidth="1.3" strokeLinecap="round">
          <path d="M198 176 q-9 -1 -13 4" />
          <path d="M198 176 q-6 -6 -12 -6" />
          <path d="M198 176 q0 -6 0 -9" />
          <path d="M198 176 q6 -6 12 -6" />
          <path d="M198 176 q9 -1 13 4" />
        </g>
      </g>
      <g>
        <path d="M108 256 Q110 248 108 240" fill="none" stroke="var(--ink-2)" strokeWidth="1.4" strokeLinecap="round" />
        <g fill="none" stroke="var(--sage)" strokeWidth="1.3" strokeLinecap="round">
          <path d="M108 240 q-9 -1 -13 4" />
          <path d="M108 240 q-6 -6 -12 -6" />
          <path d="M108 240 q0 -6 0 -9" />
          <path d="M108 240 q6 -6 12 -6" />
          <path d="M108 240 q9 -1 13 4" />
        </g>
      </g>

      {/* landmark: Public Market awning */}
      <g stroke="var(--ink)" strokeWidth="1.1" fill="none">
        <path d="M34 106 L52 106 L49 113 L37 113 Z" />
        <path d="M38 106 L37 113 M43 106 L42.5 113 M47 106 L46 113" stroke="var(--terracotta)" />
      </g>

      {/* landmark: Arlington facade */}
      <g stroke="var(--ink)" strokeWidth="1.1" fill="none">
        <path d="M198 54 L198 43 Q206 34 214 43 L214 54 Z" />
        <path d="M198 43 Q206 34 214 43" fill="var(--terracotta)" opacity=".85" stroke="none" />
        <path d="M202 54 L202 46 M210 54 L210 46" />
      </g>

      {/* landmark: Courthouse clock tower + secret */}
      <g stroke="var(--ink)" strokeWidth="1.2" fill="none">
        <rect x="278" y="120" width="13" height="27" rx="1" />
        <path d="M278 120 L284.5 110 L291 120" fill="var(--terracotta)" opacity=".85" stroke="var(--ink)" />
        <circle cx="284.5" cy="131" r="3.4" fill="var(--paper)" />
        <path d="M284.5 131 l0 -2.4 M284.5 131 l1.8 .7" />
        <path d="M281 147 q3.5 -5 7 0" />
      </g>
      <text x="271" y="114" fontFamily="var(--font-display)" fontSize="11.5" fontWeight="700" fill="var(--gold-text)">
        ✵
      </text>

      {/* landmark: La Arcada arch + fountain */}
      <g stroke="var(--ink)" strokeWidth="1.1" fill="none">
        <path d="M108 170 L108 160 Q116 152 124 160 L124 170" />
        <path d="M112 170 L112 162 Q116 158 120 162 L120 170" />
      </g>
      <path d="M116 176 q-2 -4 0 -6 q2 2 0 6" fill="none" stroke="var(--pacific)" strokeWidth="1" />

      {/* landmark: Book Den open book */}
      <g stroke="var(--ink)" strokeWidth="1.1" fill="none">
        <path d="M226 104 Q232 101 232 104 Q232 101 238 104 L238 111 Q232 108 226 111 Z" />
        <path d="M232 104 L232 111" />
      </g>

      {/* landmark: El Presidio adobe + bell */}
      <g stroke="var(--ink)" strokeWidth="1.1" fill="none">
        <rect x="262" y="200" width="18" height="13" />
        <path d="M262 200 L271 193 L280 200" fill="var(--terracotta)" opacity=".85" stroke="var(--ink)" />
        <path d="M268 213 L268 205 Q271 202 274 205 L274 213" />
        <circle cx="271" cy="196.5" r="1.5" fill="var(--ink)" />
      </g>

      {/* landmark: Paloma neon dove */}
      <circle cx="286" cy="250" r="10" fill="var(--gold)" opacity=".12" />
      <g fill="var(--gold)" stroke="var(--gold-text)" strokeWidth=".5">
        <ellipse cx="286" cy="251" rx="6.5" ry="2.6" transform="rotate(-12 286 251)" />
        <path d="M284 250 q3 -6 8.5 -4.5 q-4.5 1.5 -5 5 z" />
        <path d="M280.5 252 l-4.5 2.4 l3.2 -3.4 z" />
      </g>

      {/* landmark: Palihouse cocktail glass */}
      <g stroke="var(--tile-light)" strokeWidth="1.3" fill="none" strokeLinejoin="round" strokeLinecap="round">
        <path d="M292 188 h12 l-6 6 z" />
        <path d="M298 194 v6" />
        <path d="M295 200 h6" />
      </g>

      {/* insider callouts */}
      <text x="298" y="152" fontFamily="var(--font-display)" fontStyle="italic" fontSize="10" fill="var(--terra-text)">
        free view!
      </text>
      <path d="M297 148 Q292 141 288 134" fill="none" stroke="var(--terra-text)" strokeWidth="1" strokeLinecap="round" />
      <path d="M288 134 l1 3.4 l2.6 -1.4 z" fill="var(--terra-text)" />

      <text x="271" y="188" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fontWeight="700" fill="var(--ink-2)" letterSpacing=".5">
        est. 1782
      </text>
      <text x="302" y="248" fontFamily="var(--font-display)" fontStyle="italic" fontSize="9.5" fill="var(--gold-text)" textAnchor="middle">
        the neon still glows
      </text>
      <path d="M300 245 Q296 250 291 253" fill="none" stroke="var(--gold-text)" strokeWidth="1" strokeLinecap="round" />
      <path d="M291 253 l3.2 -.4 l-1.4 -2.9 z" fill="var(--gold-text)" />

      {/* route (terracotta dashes) */}
      <path
        d="M136 74 Q158 62 182 68 Q120 78 70 94 Q140 118 208 122 Q235 128 256 140 Q206 156 156 148 Q196 178 236 210 Q272 206 298 216 Q284 244 256 260"
        fill="none"
        stroke="var(--terracotta)"
        strokeWidth="2.2"
        strokeDasharray="1.5 6"
        strokeLinecap="round"
        opacity=".92"
      />

      {/* lower-left beach vignette */}
      <g>
        <circle cx="34" cy="231" r="8" fill="var(--gold)" opacity=".9" />
        <g stroke="var(--gold)" strokeWidth="1.3" strokeLinecap="round">
          <path d="M34 220 l0 -4 M34 242 l0 4 M23 231 l-4 0 M45 231 l4 0 M26 223 l-3 -3 M42 223 l3 -3 M26 239 l-3 3 M42 239 l3 3" />
        </g>
        <g fill="var(--ink)">
          <rect x="28.4" y="229" width="5.2" height="3.8" rx="1.7" />
          <rect x="34.8" y="229" width="5.2" height="3.8" rx="1.7" />
        </g>
        <path d="M33.6 231 l1.2 0" stroke="var(--ink)" strokeWidth="1" />
      </g>
      <text x="50" y="258" fontFamily="var(--font-display)" fontStyle="italic" fontSize="9" fill="var(--gold-text)">
        perfect, again
      </text>
      <g>
        <path d="M84 308 l0 -17" stroke="var(--ink-2)" strokeWidth="1.3" strokeLinecap="round" />
        <path d="M71 293 q13 -13 26 0 z" fill="var(--terracotta)" opacity=".85" stroke="var(--terra-text)" strokeWidth="1" />
        <path d="M84 293 l0 -7" stroke="var(--ink-2)" strokeWidth="1" />
        <path d="M77.5 293 q3 3 0 6 M90.5 293 q-3 3 0 6" stroke="var(--terra-text)" strokeWidth=".7" fill="none" opacity=".7" />
      </g>

      {/* ocean + sailboat + wharf */}
      <g stroke="var(--pacific)" strokeWidth="1.7" strokeLinecap="round" fill="none">
        <path d="M14 304 q10 -6 20 0 t20 0 t20 0 t20 0" />
        <path d="M120 308 q10 -6 20 0 t20 0 t20 0" />
        <path d="M244 304 q10 -6 20 0 t20 0 t20 0" />
      </g>
      <g stroke="var(--pacific)" strokeWidth="1.2" fill="none">
        <path d="M40 300 l15 0 l-3 5 l-9 0 z" />
        <path d="M48 300 l0 -12" />
        <path d="M48 300 l0 -12 l8 10 z" fill="var(--pacific)" opacity=".18" stroke="none" />
      </g>
      <g stroke="var(--ink-2)" strokeWidth="1" fill="none">
        <path d="M306 306 l0 -8 M313 306 l0 -8 M320 306 l0 -8" />
        <path d="M302 298 l22 0" />
      </g>
      <text x="150" y="322" fontFamily="var(--font-display)" fontStyle="italic" fontSize="13" fill="var(--pacific)" letterSpacing="2">
        the Pacific
      </text>
      <text x="313" y="292" fontFamily="var(--font-mono)" fontSize="7" fontWeight="700" fill="var(--ink-2)" textAnchor="middle">
        STEARNS WHARF
      </text>

      {/* compass */}
      <g transform="translate(335,52)">
        <circle r="12" fill="none" stroke="var(--ink-2)" strokeWidth="1.3" />
        <path d="M0 -7 L3 3 L0 1 L-3 3 Z" fill="var(--terracotta)" />
        <text x="0" y="-14" textAnchor="middle" fontFamily="var(--font-mono)" fontSize="8" fontWeight="700" fill="var(--ink-2)">
          N
        </text>
      </g>

      {/* STATE STREET stamp, top-left */}
      <g transform="translate(64,33) rotate(-6)">
        <rect x="-57" y="-23" width="114" height="46" rx="7" fill="none" stroke="var(--terra-text)" strokeWidth="1.8" />
        <rect x="-51" y="-17" width="102" height="34" rx="4" fill="none" stroke="var(--terra-text)" strokeWidth="1" strokeDasharray="4 4" />
        <text x="0" y="-3" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="900" fontSize="16" fill="var(--terra-text)" letterSpacing="3">
          STATE
        </text>
        <text x="0" y="15" textAnchor="middle" fontFamily="var(--font-display)" fontWeight="900" fontSize="16" fill="var(--terra-text)" letterSpacing="3">
          STREET
        </text>
      </g>
    </svg>
  );
}
