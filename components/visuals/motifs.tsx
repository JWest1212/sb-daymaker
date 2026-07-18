// components/visuals/motifs.tsx
//
// Card Imagery Build Spec Phase 3 §6.2, the 9 house-drawn v3 ink motifs, ported
// directly from
// docs/card-imagery/SBDaymaker_Explore_Feed_Mockup_v1.html (do not redraw the art
//, see the 2026-07-10 kickoff ledger entry for why it's 9, not the spec prose's
// "8"). Each motif keeps its own filter assignment exactly as the mockup drew it
// (`tremble` vs `tremble2`), `MotifFrame` below only factors out the repeated
// vignette/grain overlay markup, the art itself is unchanged pixel-for-pixel.
//
// `--motif-stroke`/`--motif-stroke-soft` and the `--tint-*` background colors are
// NOT semantic design tokens (`sbdaymaker_tokens.css`), they're baked-in
// illustration colors specific to this ported asset, the same exemption already
// established for the hero skyline SVG ("scene colors are baked into the asset by
// design," Hero.tsx). `--gold`/`--terracotta`/`--paper` ARE real tokens and are
// reused via var() rather than re-hardcoded, since the mockup's hex values for
// those three are exact matches.

import type { MotifKey } from "@/lib/visualAssignment";

function MotifFrame({ children }: { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 100 100" className="sbd-motif-art" aria-hidden="true">
      {children}
      <rect width="100" height="100" fill="url(#sbd-vig)" />
      <rect
        width="100"
        height="100"
        filter="url(#sbd-grain)"
        opacity={0.12}
        style={{ mixBlendMode: "multiply" }}
      />
    </svg>
  );
}

// 1 · Stage, arts/theater/live-music (Art Walk in the mockup)
function StageArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble)">
        <path className="sbd-motif-art__gold" d="M50 24 66 82H34z" opacity={0.22} />
        <path className="sbd-motif-art__body" d="M50 16q9 10 15 22-15 3-30 0 6-12 15-22z" />
        <path className="sbd-motif-art__paper" d="M50 23q6 7 10 15-10 2-20 0 4-8 10-15z" />
        <circle className="sbd-motif-art__gold" cx={50} cy={30} r={3.4} />
        <path className="sbd-motif-art__body" d="M30 82q20-3 40 0 0 1.6 0 3.2-20 2.4-40 0 0-1.6 0-3.2z" />
        <path className="sbd-motif-art__hair-t" d="M45 48l-3 12M55 48l3 12" />
      </g>
    </MotifFrame>
  );
}

// 2 · Sunset, scenic_chill (golden hour)
function SunsetArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble)">
        <circle className="sbd-motif-art__gold" cx={26} cy={42} r={10} />
        <circle cx={26} cy={42} r={12.5} fill="none" stroke="var(--terracotta)" strokeWidth={1} opacity={0.55} />
        <path className="sbd-motif-art__soft" d="M0 58q25-6 50 0t50 0v10q-25-6-50 0T0 68z" />
        <path className="sbd-motif-art__body" d="M0 68q25-6 50 0t50 0v9q-25-6-50 0T0 77z" />
        <path d="M20 60q8 10 10 22l6-1q-3-11-9-21z" fill="var(--gold)" opacity={0.3} />
        <path className="sbd-motif-art__hair" d="M10 86q8-3 16 0t16 0 16 0 16 0" />
      </g>
    </MotifFrame>
  );
}

// 3 · Market, recurring_market/festival_fair/community_gathering
function MarketArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble2)">
        <ellipse className="sbd-motif-art__soft" cx={50} cy={80} rx={26} ry={2.8} />
        <path className="sbd-motif-art__body" d="M27 47q23-1 46 0 .8 15 0 30-23 1-46 0-.8-15 0-30z" />
        <path className="sbd-motif-art__paper" d="M31 51q19-.8 38 0 .6 11 0 22-19 .8-38 0-.6-11 0-22z" />
        <path className="sbd-motif-art__body" d="M20 47q30-4 60 0l-4-16q-26-3-52 0z" />
        <path className="sbd-motif-art__terra" d="M25 34q3 7-1 11M37 33q3 7-1 11M49 33q3 7-1 11M61 33q3 7-1 11M73 34q3 7-1 11" />
        <circle className="sbd-motif-art__terra" cx={42} cy={62} r={5} />
        <circle className="sbd-motif-art__gold" cx={56} cy={64} r={5} />
      </g>
    </MotifFrame>
  );
}

// 4 · Trail, outdoor_activity/sports_outdoors_event/recurring_outdoors
function TrailArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble)">
        <circle className="sbd-motif-art__gold" cx={70} cy={28} r={9} />
        <path className="sbd-motif-art__soft" d="M6 74 34 40l16 22 6-8 32 20z" />
        <path className="sbd-motif-art__body" d="M10 78 32 46l14 20 8-11 30 23z" />
        <path className="sbd-motif-art__paper" d="M32 46l5 7-9 4z" opacity={0.7} />
        <path className="sbd-motif-art__hair-t" d="M34 52l5 7" />
        <path className="sbd-motif-art__hair" d="M8 78h80" />
      </g>
    </MotifFrame>
  );
}

// 5 · Wharf, venue-family only (Stearns Wharf)
function WharfArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble)">
        <circle className="sbd-motif-art__gold" cx={28} cy={28} r={8} />
        <path className="sbd-motif-art__hair" d="M64 22q2-2 4 0q2-2 4 0" strokeWidth={1.05} />
        <path className="sbd-motif-art__body" d="M12 48q31-2 62 0l8 11q-39-2-78 0z" />
        <path className="sbd-motif-art__paper" d="M18 50q28-1.4 56 0l4 6q-32-1.4-64 0z" opacity={0.5} />
        <path className="sbd-motif-art__body" d="M22 60q1.6 0 3 0 .4 10 0 20-1.4 0-3 0-.4-10 0-20z" />
        <path className="sbd-motif-art__body" d="M38 60q1.6 0 3 0 .4 10 0 20-1.4 0-3 0-.4-10 0-20z" />
        <path className="sbd-motif-art__body" d="M54 60q1.6 0 3 0 .4 10 0 20-1.4 0-3 0-.4-10 0-20z" />
        <path className="sbd-motif-art__body" d="M70 60q1.6 0 3 0 .4 10 0 20-1.4 0-3 0-.4-10 0-20z" />
        <path className="sbd-motif-art__hair" d="M14 84q10-5 20 0t20 0 20 0" />
        <path className="sbd-motif-art__hair-t" d="M60 40h12" />
      </g>
      <use href="#sbd-peli" x={59.5} y={76} width={10.5} height={8.4} opacity={0.9} style={{ fill: "#2b211a" }} />
    </MotifFrame>
  );
}

// 6 · Mission, venue-family only (Old Mission); the "est. 1786" garnish is always
// true here since this motif only ever renders on a real Old Mission match.
function MissionArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble)">
        <ellipse className="sbd-motif-art__soft" cx={52} cy={85} rx={34} ry={3.2} />
        <path className="sbd-motif-art__body" d="M19 84q-.5-22 .4-42 .2-3 7-7.4 6.8 4.4 7 7.4.9 20 .4 42-3.8.8-7.4.8-3.6 0-7.4-.8z" />
        <path className="sbd-motif-art__body" d="M65 84q-.5-22 .4-42 .2-3 7-7.4 6.8 4.4 7 7.4.9 20 .4 42-3.8.8-7.4.8-3.6 0-7.4-.8z" />
        <path className="sbd-motif-art__body" d="M33 84q-.6-16 0-31 8.5-7 17-12.4 8.5 5.4 17 12.4.6 15 0 31-8.6.9-17 .9-8.4 0-17-.9z" />
        <path className="sbd-motif-art__paper" d="M24 50q3-.4 6 0 .3 4.4 0 9-3 .4-6 0-.3-4.6 0-9z" />
        <path className="sbd-motif-art__paper" d="M70 50q3-.4 6 0 .3 4.4 0 9-3 .4-6 0-.3-4.6 0-9z" />
        <path className="sbd-motif-art__terra" d="M43 84q-.5-9 0-17 3.5-6 7-6t7 6q.5 8 0 17-3.5.5-7 .5t-7-.5z" />
        <path className="sbd-motif-art__paper" d="M46 84q-.4-7 0-13 2-3.4 4-3.4t4 3.4q.4 6 0 13-2 .3-4 .3t-4-.3z" />
        <path className="sbd-motif-art__soft" d="M33 53q3-3 6-4.6.4 17 0 34-3-.2-6-.7-.6-14 0-28.7z" />
        <rect className="sbd-motif-art__body" x={49} y={25} width={2.4} height={10} rx={1} />
        <rect className="sbd-motif-art__body" x={46} y={28} width={8.4} height={2.2} rx={1} />
      </g>
      <path d="M14 22 24 36" stroke="var(--ink-2)" strokeWidth={0.55} fill="none" />
      <text x={5} y={19} fontSize={4.2} fill="var(--ink-2)" style={{ fontFamily: "var(--font-mono)" }}>
        est. 1786
      </text>
    </MotifFrame>
  );
}

// 7 · Books, shopping_browse/culture_spot (Chaucer's in the mockup)
function BooksArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble2)">
        <ellipse className="sbd-motif-art__soft" cx={50} cy={79} rx={26} ry={2.6} />
        <path className="sbd-motif-art__body" d="M29 77q-.6-18 0-36 6-1 12 0 .6 18 0 36-6 1-12 0z" />
        <path className="sbd-motif-art__body" d="M42 77q-.6-16 0-32 6-1 12 0 .6 16 0 32-6 1-12 0z" />
        <path className="sbd-motif-art__body" d="M55 77 61 47q5.6.7 11 2.4L66 79q-5.6-1-11-2z" />
        <path className="sbd-motif-art__hair-t" d="M33 51h6M46 53h6" />
      </g>
    </MotifFrame>
  );
}

// 8 · Taproom, food/drink categories (Topa Topa in the mockup)
function TaproomArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble)">
        <ellipse className="sbd-motif-art__soft" cx={50} cy={80} rx={20} ry={2.6} />
        <path className="sbd-motif-art__body" d="M33 40q14-1.6 28 0 1 20 0 38-14 1.6-28 0-1-18 0-38z" />
        <path className="sbd-motif-art__paper" d="M37 46q10-1 20 0 .7 15 0 28-10 1-20 0-.7-13 0-28z" />
        <path className="sbd-motif-art__paper" d="M32 40q6-9 15-9t15 9q-15 3-30 0z" />
        <path className="sbd-motif-art__body" d="M61 47q9-1 9 8t-9 8q0-2 0-3.4 5 .4 5-4.6t-5-4.6q0-1.7 0-3.4z" />
        <path className="sbd-motif-art__gold" d="M37 52q10-1 20 0 .5 10 0 20-10 1-20 0-.5-10 0-20z" opacity={0.5} />
      </g>
    </MotifFrame>
  );
}

// 9 · Beach, scenic_chill's second variant (Butterfly Beach in the mockup; the
// sand fill #e9ddc2 is a one-off illustration color, not shared elsewhere)
function BeachArt() {
  return (
    <MotifFrame>
      <g filter="url(#sbd-tremble2)">
        <circle className="sbd-motif-art__gold" cx={72} cy={24} r={8} />
        <path className="sbd-motif-art__hair" d="M28 18q2-2 4 0q2-2 4 0" strokeWidth={1.1} />
        <path className="sbd-motif-art__hair" d="M42 26q1.6-1.6 3.2 0q1.6-1.6 3.2 0" strokeWidth={1} />
        <path className="sbd-motif-art__soft" d="M0 52q25-5 50 0t50 0v9q-25-5-50 0T0 61z" />
        <path className="sbd-motif-art__body" d="M0 61q25-5 50 0t50 0v8q-25-5-50 0T0 69z" />
        <path d="M0 77q30-4 60 0t40 0V100H0z" fill="#e9ddc2" />
        <path className="sbd-motif-art__hair" d="M8 80q7-2.6 14 0t14 0 14 0" />
        <path className="sbd-motif-art__body" d="M24 88.5q1.4-.8 2.6 0 .6 1-.3 1.7-1.4.7-2.5-.2-.4-.9.2-1.5z" />
        <path className="sbd-motif-art__body" d="M46 92q1-.6 2 0 .5.8-.2 1.4-1 .5-1.9-.2-.3-.7.1-1.2z" />
        <path className="sbd-motif-art__body" d="M62 87.6q.9-.5 1.7 0 .4.7-.2 1.2-.9.4-1.6-.2-.3-.6.1-1z" />
      </g>
      <use href="#sbd-peli" x={75} y={80.5} width={9.5} height={7.6} opacity={0.95} style={{ fill: "#2b211a" }} />
    </MotifFrame>
  );
}

interface MotifDef {
  /** Applied to the rail container (`.sbd-listcard__rail`), same role as the
   *  mockup's `.t-*` classes on `.card__visual`. */
  tintClass: string;
  Art: () => React.ReactElement;
}

export const MOTIFS: Record<MotifKey, MotifDef> = {
  stage: { tintClass: "sbd-tint-stage", Art: StageArt },
  sunset: { tintClass: "sbd-tint-sunset", Art: SunsetArt },
  market: { tintClass: "sbd-tint-market", Art: MarketArt },
  trail: { tintClass: "sbd-tint-trail", Art: TrailArt },
  wharf: { tintClass: "sbd-tint-wharf", Art: WharfArt },
  mission: { tintClass: "sbd-tint-mission", Art: MissionArt },
  books: { tintClass: "sbd-tint-books", Art: BooksArt },
  taproom: { tintClass: "sbd-tint-taproom", Art: TaproomArt },
  beach: { tintClass: "sbd-tint-beach", Art: BeachArt },
};
