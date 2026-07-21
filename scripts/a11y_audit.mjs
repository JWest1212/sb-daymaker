// Accessibility audit: runs the real axe-core engine against the server-rendered
// HTML of the core routes, via jsdom (no browser needed here). Catches the
// structural WCAG rules (alt text, control labels, roles, landmarks, ARIA,
// heading order, lang, duplicate ids). Contrast and hydrated-interactive checks
// need a real browser (Lighthouse in Chrome / axe in Playwright); this is the
// no-browser subset that runs anywhere, incl. CI.
//
// RUN (dev server must be up on :3000):  node scripts/a11y_audit.mjs
//
// No em dash (Golden Rule).

import { readFileSync } from "node:fs";
import { JSDOM, VirtualConsole } from "jsdom";
import { createClient } from "@supabase/supabase-js";

const BASE = process.env.A11Y_BASE || "http://localhost:3000";
const axeSource = readFileSync(new URL("../node_modules/axe-core/axe.min.js", import.meta.url), "utf8");

// A valid detail-page slug (detail is the most complete SSR route).
const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8")
  .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"));
const cfg = {};
for (const line of env) { const i = line.indexOf("="); cfg[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, ""); }
const sb = createClient(cfg.NEXT_PUBLIC_SUPABASE_URL, cfg.SUPABASE_SECRET_KEY, { auth: { persistSession: false } });
const { data: t } = await sb.from("things").select("slug,id").eq("status", "published").not("slug", "is", null).limit(1);
const thingPath = t?.[0] ? `/thing/${t[0].slug ?? t[0].id}` : null;

const ROUTES = ["/", "/plan", "/saved", thingPath].filter(Boolean);

async function auditRoute(path) {
  const res = await fetch(`${BASE}${path}`);
  const html = await res.text();
  const vc = new VirtualConsole(); // swallow page JS noise
  const dom = new JSDOM(html, { url: `${BASE}${path}`, runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc });
  const { window } = dom;
  const s = window.document.createElement("script");
  s.textContent = axeSource;
  window.document.head.appendChild(s);
  try {
    const results = await window.axe.run(window.document, {
      resultTypes: ["violations"],
      // contrast needs real layout; jsdom can't, so exclude it here (verify in a browser).
      rules: { "color-contrast": { enabled: false } },
    });
    return results.violations;
  } finally {
    window.close();
  }
}

const impactRank = { critical: 0, serious: 1, moderate: 2, minor: 3 };
const summary = {};

for (const path of ROUTES) {
  let violations;
  try { violations = await auditRoute(path); }
  catch (e) { console.log(`\n### ${path}\n  audit error: ${String(e).slice(0, 160)}`); continue; }
  console.log(`\n### ${path}  (${violations.length} violation type${violations.length === 1 ? "" : "s"})`);
  violations.sort((a, b) => (impactRank[a.impact] ?? 9) - (impactRank[b.impact] ?? 9));
  for (const v of violations) {
    summary[v.impact] = (summary[v.impact] ?? 0) + v.nodes.length;
    console.log(`  [${(v.impact || "n/a").toUpperCase()}] ${v.id}: ${v.help} (${v.nodes.length} node${v.nodes.length === 1 ? "" : "s"})`);
    console.log(`         ${v.nodes[0]?.target?.join(" ") ?? ""}`.slice(0, 140));
  }
}

console.log(`\n=== summary (nodes by impact) === ${JSON.stringify(summary)}`);
console.log("note: color-contrast + hydrated-interactive states need a real browser (Lighthouse/Playwright).");
process.exit(0);
