// scripts/gen-tile-art.mjs
//
// The Area, Occasion and Activity picker tiles' artwork (2026-09-22, Jim): a
// flat, solid ground in the picker's own colour and one simple line icon in
// Paper, in the upper right so the tile's white label (bottom left) stays
// readable. Replaces photographs that were never shipped (every tile 404'd).
//
// Hexes are written out because a static SVG cannot read CSS tokens; they are
// the tokens (sbdaymaker_tokens.css): Pacific Dark #0E3C49, Purple #9C6B9E and
// Terracotta #C0532E darkened 15% (the tiles' existing background-color), Paper
// #FCFAF5, Gold #E0A82E.
//
// Run: node scripts/gen-tile-art.mjs   (writes public/tiles/{place,vibe,activity}/*.svg)

import { mkdirSync, writeFileSync } from "node:fs";

const PAPER = "#FCFAF5";
const GOLD = "#E0A82E";
const GROUND = {
  place: "#0E3C49",
  vibe: "#855B86",
  activity: "#A34727",
};

// Icons on a 48-unit grid. Strokes only (fill none) unless a shape says otherwise.
const ICONS = {
  // ---- Areas ----
  downtown_state: `<path d="M10 42V22h28v20M6 42h36M14 22V16h20v6M24 16V8M20 8h8"/><circle cx="24" cy="29" r="4"/><path d="M24 27v2l1.5 1.5"/>`,
  funk_zone: `<path d="M30 6l12 12-16 16-8 2 2-8z"/><path d="M26 10l12 12"/><path d="M14 38c-4 0-7 2-8 4 4 1 9 0 11-3"/>`,
  waterfront_harbor: `<path d="M24 6v28M24 8l14 22H24M24 12L12 30h12"/><path d="M6 36h36l-4 6H10z"/>`,
  mesa: `<path d="M4 34h14l6-10h20"/><circle cx="34" cy="14" r="6" fill="${GOLD}" stroke="none"/><path d="M4 42h40"/>`,
  mission_riviera: `<path d="M12 42V18l12-10 12 10v24"/><path d="M20 42V32a4 4 0 0 1 8 0v10"/><path d="M24 16a3 3 0 0 1 3 3v3h-6v-3a3 3 0 0 1 3-3z"/>`,
  upper_state: `<path d="M24 42V22"/><path d="M24 22c-6-2-12 0-15 5M24 22c6-2 12 0 15 5M24 22c-2-6-8-10-14-9M24 22c2-6 8-10 14-9M24 22c0-7 2-12 6-15"/>`,
  goleta_isla_vista: `<path d="M4 26c4-4 8-4 12 0s8 4 12 0 8-4 12 0 4 2 4 2"/><path d="M4 36c4-4 8-4 12 0s8 4 12 0 8-4 12 0 4 2 4 2"/><path d="M34 6l6 10"/>`,
  montecito_carpinteria: `<path d="M2 40l14-22 8 12 6-8 16 18z"/><path d="M12 25l4-7 4 6"/>`,
  // ---- Occasions ----
  date_night: `<path d="M14 8h10l-1 10a4 4 0 0 1-8 0z"/><path d="M19 22v14M14 36h10"/><path d="M28 8h10l-1 10a4 4 0 0 1-8 0z"/><path d="M33 22v14M28 36h10"/>`,
  family_day: `<path d="M26 6l14 14-10 10-14-14z"/><path d="M28 30c-2 4-6 6-10 6s-8 4-8 8"/><path d="M26 6l4 24"/>`,
  // nightlife (the occasion) is NIGHT_MOON below; the key is shared with the activity.
  hosting_visitors: `<rect x="8" y="16" width="32" height="24" rx="3"/><path d="M18 16v-6h12v6M8 26h32"/>`,
  solo: `<circle cx="24" cy="12" r="5"/><path d="M24 17v14M24 31l-7 11M24 31l7 11M16 24h16"/>`,
  free_sb: `<path d="M6 16h36v6a4 4 0 0 0 0 8v6H6v-6a4 4 0 0 0 0-8z"/><path d="M28 16v20" stroke-dasharray="3 3"/>`,
  rainy_day: `<path d="M14 28a8 8 0 0 1 1-16 11 11 0 0 1 21 3 7 7 0 0 1-1 13z"/><path d="M16 34l-2 6M24 34l-2 6M32 34l-2 6"/>`,
  dog_friendly: `<ellipse cx="24" cy="32" rx="8" ry="7"/><ellipse cx="12" cy="20" rx="3.5" ry="4.5"/><ellipse cx="20" cy="12" rx="3.5" ry="4.5"/><ellipse cx="28" cy="12" rx="3.5" ry="4.5"/><ellipse cx="36" cy="20" rx="3.5" ry="4.5"/>`,
  // ---- Activities ----
  "live-music": `<path d="M18 34V10l20-4v24"/><circle cx="13" cy="34" r="5"/><circle cx="33" cy="30" r="5"/><path d="M18 16l20-4"/>`,
  "arts-galleries": `<rect x="6" y="10" width="36" height="28" rx="2"/><path d="M6 32l10-10 8 8 6-6 12 12"/><circle cx="32" cy="18" r="3"/>`,
  "food-drink": `<path d="M14 6v12a4 4 0 0 0 8 0V6M18 6v36"/><path d="M34 6c-4 2-5 8-5 14h5v22"/>`,
  outdoors: `<path d="M4 40l12-20 6 9 8-15 14 26z"/><circle cx="36" cy="10" r="4" fill="${GOLD}" stroke="none"/>`,
  markets: `<path d="M6 16l4-8h28l4 8"/><path d="M6 16c0 3 3 5 6 5s6-2 6-5c0 3 3 5 6 5s6-2 6-5c0 3 3 5 6 5s6-2 6-5"/><path d="M10 21v19h28V21M20 40v-9h8v9"/>`,
  "family-kids": `<ellipse cx="24" cy="16" rx="9" ry="11"/><path d="M24 27l-2 3h4z"/><path d="M24 30c0 4-4 6-2 12"/>`,
  "film-talks": `<rect x="6" y="18" width="36" height="22" rx="2"/><path d="M6 18l4-10 36 0-4 10"/><path d="M16 8l-4 10M26 8l-4 10M36 8l-4 10"/>`,
  "wellness-fitness": `<path d="M4 26h8l4-8 6 16 5-12 3 4h14"/>`,
  nightlife: `<path d="M8 8h32L24 26z"/><path d="M24 26v14M16 40h16"/><path d="M30 14l6-8"/><circle cx="37" cy="5" r="2"/>`,
  "community-festivals": `<path d="M4 10c10 8 30 8 40 0"/><path d="M8 13l3 9 4-8M18 16l3 9 4-9M29 16l3 9 3-9M39 13l-2 9"/>`,
};

const DIMENSION_OF = {
  place: ["downtown_state", "funk_zone", "waterfront_harbor", "mesa", "mission_riviera", "upper_state", "goleta_isla_vista", "montecito_carpinteria"],
  vibe: ["date_night", "family_day", "nightlife", "hosting_visitors", "solo", "free_sb", "rainy_day", "dog_friendly"],
  activity: ["live-music", "arts-galleries", "food-drink", "outdoors", "markets", "family-kids", "film-talks", "wellness-fitness", "nightlife", "community-festivals"],
};

function svg(dimension, key) {
  // "nightlife" is both an occasion (a moon) and an activity (a cocktail).
  const body = dimension === "vibe" && key === "nightlife" ? NIGHT_MOON : ICONS[key];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" role="img" aria-hidden="true">
  <rect width="320" height="160" fill="${GROUND[dimension]}"/>
  <circle cx="276" cy="46" r="56" fill="${PAPER}" fill-opacity="0.07"/>
  <g transform="translate(242 12) scale(1.45)" fill="none" stroke="${PAPER}" stroke-opacity="0.92" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${body}</g>
</svg>
`;
}

// Occasion "nightlife": moon and stars. Activity "nightlife": a cocktail.
const NIGHT_MOON = `<path d="M30 8a14 14 0 1 0 10 22A12 12 0 0 1 30 8z"/><path d="M12 10v6M9 13h6M40 8v4M38 10h4"/>`;

let n = 0;
for (const [dimension, keys] of Object.entries(DIMENSION_OF)) {
  mkdirSync(`public/tiles/${dimension}`, { recursive: true });
  for (const key of keys) {
    writeFileSync(`public/tiles/${dimension}/${key}.svg`, svg(dimension, key));
    n++;
  }
}
console.log(`gen-tile-art: wrote ${n} tiles`);
