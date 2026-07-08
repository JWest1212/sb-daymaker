// lib/edition/render.ts
//
// The renderer (edition_build_spec.md §6, amended by
// edition_build_spec_ADDENDUM_mobile.md Part A — mobile-first base sizing).
// Pure functions: given a fully resolved edition (overrides already applied
// by the caller — renderData.ts — so this file knows nothing about the DB),
// produce the email HTML, its plain-text alternative, and preview markup for
// the permalink page (which reuses this same HTML, so the mobile sizing
// applies there too — see app/edition/[date]/route.ts).
//
// Table-based layout + inline styles (email clients strip <style> — the mockup's
// CSS custom properties become literal hex values here, sourced from
// sbdaymaker_tokens.css, never re-invented). The zoned-band effect survives as
// table-cell background colors. A small <style> block layers in dark-mode
// overrides (media-query rules can't target inline styles, so key elements
// also carry class names) and web-font declarations with system-font fallbacks.
//
// Sizing note (addendum Part A, then a second pass after real-device
// testing): these are BASE sizes, not gated behind a min-width media query —
// Gmail and others strip media queries, and the mobile-tuned sizes read fine
// on desktop too. The first live test send (2026-07-09) rendered correctly
// but too small on iPhone (13px body text, 78px thumbnails, sub-44px tap
// targets). Part A's addendum sizes were a real improvement but still read
// small on a second real-device test — body copy topped out at 15-17px,
// under iOS's own 17pt native body-text baseline (Apple HIG), so a reader's
// eye is calibrated larger than what shipped. This second pass pushes body
// copy to 16-19px and titles/headlines further up accordingly, matching how
// premium mobile-read newsletters (Morning Brew, Stratechery, etc.) size
// their type — comfortably past the native baseline, not just at it.
//
// Em-dash normalization (§6.6) runs here, last, over every assembled string —
// belt-and-suspenders even though the drafter's own authored strings
// (subject/preheader/greeting) are already clean and reused thing fields
// shouldn't be rewritten upstream of this pass.

import { stripEmDashes } from "./emdash";
import type { EditionType } from "./types";

// ---- tokens (sbdaymaker_tokens.css — literal hex, never re-derived) --------
const C = {
  plaster: "#F6F1E7",
  plaster2: "#EFE7D8",
  paper: "#FCFAF5",
  ink: "#241C16",
  ink2: "#4A4038",
  pacific: "#16586A",
  terracotta: "#C0532E",
  terraText: "#9E3F20",
  gold: "#E0A82E",
  goldText: "#7A5E13",
  line: "#D8CDB8",
} as const;

// Hand-built dark mapping (the app itself has no dark theme to reuse — see
// file header). Ink becomes the dark ground; Plaster becomes the dark text.
const DARK = {
  bg: "#241C16",
  card: "#2E241C",
  zone: "#2A2018",
  text: "#F6F1E7",
  muted: "#D8CDB8",
  border: "#4A3F33",
  accent: "#E8B84A",
} as const;

const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "'Courier New', monospace";

export interface RenderPick {
  thingId: string;
  title: string;
  blurb: string | null;
  when: string;
  neighborhood: string | null;
  localNote: string | null; // caller passes it through unguarded; renderer applies the length guard
  imageUrl: string | null;
  imageAttribution: string | null;
  dayLabel: string | null; // secondaries only, e.g. "Saturday"
  href: string;
}

export interface RenderableEdition {
  editionType: EditionType;
  subject: string;
  preheader: string;
  greeting: string;
  windowLabel: string;
  dateLabel: string; // e.g. "Thu Jul 9"
  secondariesLabel: string;
  nonEventLabel: string;
  hero: RenderPick | null;
  secondaries: RenderPick[];
  nonEvent: RenderPick | null;
  anchor: RenderPick | null;
  permalinkUrl: string;
  subscribeUrl: string;
  unsubscribeUrl: string | null; // null in the permalink/preview context (no recipient)
}

const LOCAL_SECRET_MIN_LENGTH = 40;

function esc(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Every assembled string goes through this before it's placed in markup:
 *  escape first (so a stray & in a title doesn't break the table), THEN strip
 *  em dashes (order matters not at all here since — isn't an HTML metachar,
 *  but keeping escape-then-normalize consistent avoids double-processing). */
function clean(input: string | null | undefined): string {
  return esc(stripEmDashes(input ?? ""));
}

function altText(title: string, attribution: string | null): string {
  return attribution ? `${title} (photo: ${attribution})` : title;
}

/** A flat, on-brand color band — the email-safe equivalent of the mockup's
 *  golden-hour gradient hero. True CSS gradients + text-over-image aren't
 *  reliable across email clients, so "never blank" here means a solid brand
 *  color band, not a pixel-identical gradient. Height matches the real hero
 *  image band (210px, addendum Part A) so the fallback never reads as a
 *  smaller, lesser version of the real thing. */
function colorBand(height: number, color: string): string {
  return `<div style="height:${height}px;line-height:${height}px;font-size:1px;background-color:${color};">&nbsp;</div>`;
}

// Addendum Part A: hero image band grows from ~150px to a fixed 210px at
// mobile width (fluid width, cropped height) so it carries real visual
// weight instead of shrinking to whatever the source photo's aspect ratio
// happens to be. object-fit:cover crops rather than squashes.
const HERO_IMAGE_HEIGHT = 210;
// Secondary thumbnails: 78px -> 104px square (addendum Part A).
const THUMB_SIZE = 104;
const THUMB_RADIUS = 12;

function heroImageBlock(hero: RenderPick): string {
  if (hero.imageUrl) {
    return `<img src="${esc(hero.imageUrl)}" alt="${clean(altText(hero.title, hero.imageAttribution))}" width="600" height="${HERO_IMAGE_HEIGHT}" style="display:block;width:100%;max-width:600px;height:${HERO_IMAGE_HEIGHT}px;object-fit:cover;border:0;" />`;
  }
  return colorBand(HERO_IMAGE_HEIGHT, C.terracotta);
}

function thumbBlock(pick: RenderPick, size: number): string {
  if (pick.imageUrl) {
    return `<img src="${esc(pick.imageUrl)}" alt="${clean(altText(pick.title, pick.imageAttribution))}" width="${size}" height="${size}" style="display:block;width:${size}px;height:${size}px;border-radius:${THUMB_RADIUS}px;border:0;object-fit:cover;" />`;
  }
  return `<div style="width:${size}px;height:${size}px;border-radius:${THUMB_RADIUS}px;background-color:${C.pacific};font-size:1px;line-height:${size}px;">&nbsp;</div>`;
}

function secondaryRow(pick: RenderPick, isFirst: boolean): string {
  return `
  <tr><td class="sbd-border" style="padding:16px 20px;border-top:${isFirst ? "none" : `1px solid ${C.line}`};">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td width="${THUMB_SIZE}" valign="top" style="padding-right:14px;">${thumbBlock(pick, THUMB_SIZE)}</td>
      <td valign="top">
        ${pick.dayLabel ? `<p class="sbd-fm sbd-accent" style="font-family:${FONT_MONO};font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.pacific};margin:0;">${clean(pick.dayLabel)}</p>` : ""}
        <h3 class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:25px;line-height:1.2;color:${C.ink};margin:7px 0 8px;">${clean(pick.title)}</h3>
        <p class="sbd-fm sbd-muted" style="font-family:${FONT_MONO};font-size:16px;color:${C.ink2};margin:0 0 9px;">${clean(pick.when)}${pick.neighborhood ? ` &middot; ${clean(pick.neighborhood)}` : ""}</p>
        ${pick.blurb ? `<p class="sbd-muted" style="font-size:21px;line-height:1.45;color:${C.ink2};margin:0;">${clean(pick.blurb)}</p>` : ""}
        <p style="margin:13px 0 0;"><a href="${esc(pick.href)}" class="sbd-accent" style="font-size:18px;font-weight:700;color:${C.pacific};text-decoration:none;">See it &rarr;</a></p>
      </td>
    </tr></table>
  </td></tr>`;
}

function specialBlock(label: string, pick: RenderPick, bg: string, labelColor: string): string {
  return `
  <tr><td class="sbd-zone" style="background-color:${bg};padding:18px 20px 20px;">
    <p class="sbd-fm" style="font-family:${FONT_MONO};font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${labelColor};margin:0 0 10px;">${clean(label)}</p>
    <h3 class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:26px;line-height:1.2;color:${C.ink};margin:0 0 9px;">${clean(pick.title)}</h3>
    ${pick.blurb ? `<p class="sbd-muted" style="font-size:21px;line-height:1.45;color:${C.ink2};margin:0 0 13px;">${clean(pick.blurb)}</p>` : ""}
    <a href="${esc(pick.href)}" class="sbd-accent" style="font-size:18px;font-weight:700;color:${C.pacific};text-decoration:none;">See it &rarr;</a>
  </td></tr>`;
}

export function renderEditionEmailHtml(ed: RenderableEdition): string {
  const hero = ed.hero;
  const showSecret = hero && (hero.localNote?.length ?? 0) >= LOCAL_SECRET_MIN_LENGTH;

  const secondariesRows = ed.secondaries.map((p, i) => secondaryRow(p, i === 0)).join("");
  const nonEventRow = ed.nonEvent ? specialBlock(ed.nonEventLabel, ed.nonEvent, C.paper, C.pacific) : "";
  const anchorRow = ed.anchor ? specialBlock("Always worth it", ed.anchor, C.plaster2, C.goldText) : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${clean(ed.subject)}</title>
<style>
  body,table,td,a{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table,td{ mso-table-lspace:0pt; mso-table-rspace:0pt; }
  img{ -ms-interpolation-mode:bicubic; }
  @media (prefers-color-scheme: dark) {
    .sbd-bg{ background-color:${DARK.bg} !important; }
    .sbd-card{ background-color:${DARK.card} !important; }
    .sbd-zone{ background-color:${DARK.zone} !important; }
    .sbd-text{ color:${DARK.text} !important; }
    .sbd-muted{ color:${DARK.muted} !important; }
    .sbd-border{ border-color:${DARK.border} !important; }
    .sbd-accent{ color:${DARK.accent} !important; }
  }
</style>
</head>
<body class="sbd-bg" style="margin:0;padding:0;background-color:${C.plaster};font-family:${FONT_BODY};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${clean(ed.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="sbd-bg" style="background-color:${C.plaster};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="sbd-card" style="width:600px;max-width:100%;background-color:${C.paper};border-radius:16px;overflow:hidden;">

<tr><td style="padding:20px 20px 14px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:26px;padding-right:9px;"><div style="width:22px;height:22px;border-radius:999px;background-color:${C.gold};font-size:1px;line-height:22px;">&nbsp;</div></td>
    <td class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:30px;color:${C.ink};">SB Daymaker</td>
  </tr></table>
  <div style="height:5px;margin-top:14px;border-radius:3px;background-color:${C.gold};font-size:1px;line-height:5px;">&nbsp;</div>
  <p class="sbd-fm sbd-accent" style="font-family:${FONT_MONO};font-size:15px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.pacific};margin:13px 0 0;">${clean(ed.windowLabel)} &middot; ${clean(ed.dateLabel)}</p>
  <p class="sbd-muted" style="font-size:21px;line-height:1.5;color:${C.ink2};margin:10px 0 0;">${clean(ed.greeting)}</p>
</td></tr>

${hero ? `
<tr><td>${heroImageBlock(hero)}</td></tr>
<tr><td class="sbd-card" style="background-color:${C.paper};padding:20px 20px 22px;">
  <p class="sbd-fm" style="font-family:${FONT_MONO};font-size:15px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:${C.terraText};margin:0 0 11px;">&bull;&nbsp;THE MOVE</p>
  <h2 class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:36px;line-height:1.15;color:${C.ink};margin:0 0 12px;">${clean(hero.title)}</h2>
  <p class="sbd-fm sbd-muted" style="font-family:${FONT_MONO};font-size:17px;font-weight:600;color:${C.ink2};margin:0;">${clean(hero.when)}${hero.neighborhood ? ` &middot; <span class="sbd-accent" style="color:${C.pacific};">${clean(hero.neighborhood)}</span>` : ""}</p>
  ${hero.blurb ? `<p class="sbd-muted" style="font-size:23px;line-height:1.5;color:${C.ink2};margin:14px 0 0;">${clean(hero.blurb)}</p>` : ""}
  ${showSecret ? `
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;"><tr>
    <td class="sbd-zone" style="background-color:${C.plaster};border-left:4px solid ${C.gold};border-radius:0 9px 9px 0;padding:16px 18px;">
      <p class="sbd-fm" style="font-family:${FONT_MONO};font-size:14px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${C.goldText};margin:0 0 7px;">Local's secret</p>
      <p class="sbd-muted" style="font-size:20px;line-height:1.45;color:${C.ink2};margin:0;">${clean(hero.localNote)}</p>
    </td>
  </tr></table>` : ""}
  <p style="margin:20px 0 0;"><a href="${esc(hero.href)}" style="display:inline-block;background-color:${C.pacific};color:${C.paper};text-decoration:none;font-weight:700;font-size:19px;padding:17px 32px;border-radius:999px;">See it &rarr;</a></p>
</td></tr>` : ""}

${ed.secondaries.length ? `
<tr><td class="sbd-zone" style="background-color:${C.plaster};padding:2px 0 8px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="padding:18px 20px 4px;">
    <p class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-style:italic;font-weight:600;font-size:26px;color:${C.ink};margin:0;">${clean(ed.secondariesLabel)}</p>
  </td></tr></table>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${secondariesRows}</table>
</td></tr>` : ""}

${nonEventRow ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${nonEventRow}</table></td></tr>` : ""}
${anchorRow ? `<tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0">${anchorRow}</table></td></tr>` : ""}

<tr><td class="sbd-bg" style="background-color:${C.plaster};padding:22px 20px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="sbd-card" style="background-color:${C.paper};border-radius:13px;"><tr><td style="padding:17px 18px;">
    <p class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:23px;color:${C.ink};margin:0 0 9px;">Know someone new to town?</p>
    <p class="sbd-muted" style="font-size:20px;line-height:1.45;color:${C.ink2};margin:0 0 16px;">Forward this along. SB Daymaker tells them what's worth doing in Santa Barbara, twice a week.</p>
    <a href="${esc(ed.subscribeUrl)}" style="display:inline-block;font-size:18px;font-weight:700;color:${C.paper};background-color:${C.pacific};border-radius:999px;padding:15px 26px;text-decoration:none;">Get it in your inbox &rarr;</a>
  </td></tr></table>
  <p class="sbd-muted" style="font-size:17px;line-height:1.45;color:${C.ink2};margin:20px 0 12px;">You're getting this because you asked SB Daymaker what's worth doing in Santa Barbara.</p>
  <p class="sbd-muted" style="font-size:17px;line-height:1.45;color:${C.ink2};margin:0 0 12px;">Two a week: Thursday and Sunday. No more than that.${ed.unsubscribeUrl ? ` &middot; <a href="${esc(ed.unsubscribeUrl)}" class="sbd-accent" style="color:${C.pacific};">Unsubscribe</a>` : ""}</p>
  <p class="sbd-fm sbd-muted" style="font-family:${FONT_MONO};font-size:15px;color:${C.ink2};margin:0;">SB Daymaker &middot; 78 Brandon Drive, Goleta, CA 93117</p>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

function textRule(width = 40): string {
  return "-".repeat(width);
}

export function renderEditionPlainText(ed: RenderableEdition): string {
  const lines: string[] = [];
  const push = (s: string) => lines.push(stripEmDashes(s));

  push("SB DAYMAKER");
  push(`${ed.windowLabel} - ${ed.dateLabel}`);
  push("");
  push(ed.greeting);
  push("");

  if (ed.hero) {
    push(textRule());
    push("THE MOVE");
    push(ed.hero.title);
    push([ed.hero.when, ed.hero.neighborhood].filter(Boolean).join(" - "));
    if (ed.hero.blurb) push(ed.hero.blurb);
    if ((ed.hero.localNote?.length ?? 0) >= LOCAL_SECRET_MIN_LENGTH) {
      push(`Local's secret: ${ed.hero.localNote}`);
    }
    push(`See it: ${ed.hero.href}`);
    push("");
  }

  if (ed.secondaries.length) {
    push(textRule());
    push(ed.secondariesLabel.toUpperCase());
    for (const p of ed.secondaries) {
      push("");
      if (p.dayLabel) push(p.dayLabel.toUpperCase());
      push(p.title);
      push([p.when, p.neighborhood].filter(Boolean).join(" - "));
      if (p.blurb) push(p.blurb);
      push(`See it: ${p.href}`);
    }
    push("");
  }

  if (ed.nonEvent) {
    push(textRule());
    push(ed.nonEventLabel.toUpperCase());
    push(ed.nonEvent.title);
    if (ed.nonEvent.blurb) push(ed.nonEvent.blurb);
    push(`See it: ${ed.nonEvent.href}`);
    push("");
  }

  if (ed.anchor) {
    push(textRule());
    push("ALWAYS WORTH IT");
    push(ed.anchor.title);
    if (ed.anchor.blurb) push(ed.anchor.blurb);
    push(`See it: ${ed.anchor.href}`);
    push("");
  }

  push(textRule());
  push("Know someone new to town? Forward this along. SB Daymaker tells them");
  push("what's worth doing in Santa Barbara, twice a week.");
  push(`Get it in your inbox: ${ed.subscribeUrl}`);
  push("");
  push("You're getting this because you asked SB Daymaker what's worth doing in Santa Barbara.");
  push("Two a week: Thursday and Sunday. No more than that.");
  if (ed.unsubscribeUrl) push(`Unsubscribe: ${ed.unsubscribeUrl}`);
  push("SB Daymaker, 78 Brandon Drive, Goleta, CA 93117");

  return lines.join("\n");
}
