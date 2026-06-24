// One-off: rasterize public/icon.svg into the PWA/Apple PNG icons.
// Run: node scripts/gen-icons.mjs   (re-run if icon.svg changes)
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const svgPath = fileURLToPath(new URL("../public/icon.svg", import.meta.url));
const out = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const svg = readFileSync(svgPath);

const PACIFIC = "#16586A";

await Promise.all([
  // "any" purpose — rounded corners (transparent) are fine; Android masks them.
  sharp(svg).resize(192, 192).png().toFile(out("icon-192.png")),
  sharp(svg).resize(512, 512).png().toFile(out("icon-512.png")),
  // maskable — must be full-bleed (no transparent corners).
  sharp(svg).flatten({ background: PACIFIC }).resize(512, 512).png().toFile(out("icon-maskable-512.png")),
  // apple-touch — iOS adds its own rounding; give it an opaque square.
  sharp(svg).flatten({ background: PACIFIC }).resize(180, 180).png().toFile(out("apple-icon-180.png")),
]);

console.log("✓ icons generated: icon-192, icon-512, icon-maskable-512, apple-icon-180");
