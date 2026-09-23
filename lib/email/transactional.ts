// lib/email/transactional.ts  (R1 W7.7 · EML-001)
//
// The digest's own template, for the one-line emails: confirm, restore link,
// and any future unsubscribe note. The confirmation used to be three unstyled
// paragraphs and a default blue link; nothing about it looked like the site
// that sent it, on a product whose whole pitch is taste.
//
// Same rules as lib/edition/render.ts: table layout, inline styles, the token
// hexes written out because email clients cannot read CSS variables, a dark
// mode block for the clients that honour it, and a plain-text alternative.

import { stripEmDashes } from "@/lib/edition/emdash";
import { CADENCE_LINE } from "@/lib/edition/cadence";

const C = {
  plaster: "#F6F1E7",
  paper: "#FCFAF5",
  ink: "#241C16",
  ink2: "#4A4038",
  pacific: "#16586A",
  gold: "#E0A82E",
} as const;
const DARK = { bg: "#241C16", card: "#2E241C", text: "#F6F1E7", muted: "#D8CDB8", accent: "#E8B84A" } as const;
const FONT_DISPLAY = "Georgia, 'Times New Roman', serif";
const FONT_BODY = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const FONT_MONO = "'Courier New', monospace";

export const MAILING_ADDRESS = "SB Daymaker · 78 Brandon Drive, Goleta, CA 93117";

function esc(s: string): string {
  return stripEmDashes(s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

export interface TransactionalEmail {
  /** Hidden preview line. */
  preheader: string;
  /** The Fraunces heading. */
  heading: string;
  /** Plain sentences, one per paragraph. Escaped here. */
  paragraphs: string[];
  /** The one Pacific button. */
  button: { label: string; url: string };
  /** Small print under the button, e.g. "Didn't sign up? Ignore this." Plain text;
   *  `{unsubscribe}` is replaced with a link when `unsubscribeUrl` is given. */
  footNote?: string;
  unsubscribeUrl?: string | null;
  /** Whether to print the cadence line. On for the digest confirm. */
  cadence?: boolean;
}

export function renderTransactionalEmail(m: TransactionalEmail): { html: string; text: string } {
  const paragraphs = m.paragraphs
    .map((p) => `<p class="sbd-muted" style="font-size:19px;line-height:1.5;color:${C.ink2};margin:0 0 14px;">${esc(p)}</p>`)
    .join("");
  const foot = m.footNote
    ? `<p class="sbd-muted" style="font-size:15px;line-height:1.5;color:${C.ink2};margin:22px 0 0;">${
        esc(m.footNote).replace(
          "{unsubscribe}",
          m.unsubscribeUrl ? `<a href="${esc(m.unsubscribeUrl)}" class="sbd-accent" style="color:${C.pacific};">unsubscribe</a>` : "unsubscribe",
        )
      }</p>`
    : "";
  const cadence = m.cadence
    ? `<p class="sbd-fm sbd-accent" style="font-family:${FONT_MONO};font-size:14px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${C.pacific};margin:0 0 12px;">${esc(CADENCE_LINE)}</p>`
    : "";

  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${esc(m.heading)}</title>
<style>
  body,table,td,a{ -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  @media (prefers-color-scheme: dark) {
    .sbd-bg{ background-color:${DARK.bg} !important; }
    .sbd-card{ background-color:${DARK.card} !important; }
    .sbd-text{ color:${DARK.text} !important; }
    .sbd-muted{ color:${DARK.muted} !important; }
    .sbd-accent{ color:${DARK.accent} !important; }
  }
</style>
</head>
<body class="sbd-bg" style="margin:0;padding:0;background-color:${C.plaster};font-family:${FONT_BODY};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${esc(m.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="sbd-bg" style="background-color:${C.plaster};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" class="sbd-card" style="width:600px;max-width:100%;background-color:${C.paper};border-radius:16px;overflow:hidden;">
<tr><td style="padding:20px 20px 14px;">
  <table role="presentation" cellpadding="0" cellspacing="0"><tr>
    <td style="width:26px;padding-right:9px;"><div style="width:22px;height:22px;border-radius:999px;background-color:${C.gold};font-size:1px;line-height:22px;">&nbsp;</div></td>
    <td class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:30px;color:${C.ink};">SB Daymaker</td>
  </tr></table>
  <div style="height:5px;margin-top:14px;border-radius:3px;background-color:${C.gold};font-size:1px;line-height:5px;">&nbsp;</div>
</td></tr>
<tr><td style="padding:10px 20px 26px;">
  ${cadence}
  <h1 class="sbd-fd sbd-text" style="font-family:${FONT_DISPLAY};font-weight:700;font-size:28px;line-height:1.2;color:${C.ink};margin:0 0 14px;">${esc(m.heading)}</h1>
  ${paragraphs}
  <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr>
    <td style="border-radius:999px;background-color:${C.pacific};">
      <a href="${esc(m.button.url)}" style="display:inline-block;padding:14px 26px;font-family:${FONT_BODY};font-size:17px;font-weight:700;color:${C.paper};text-decoration:none;border-radius:999px;">${esc(m.button.label)}</a>
    </td>
  </tr></table>
  <p class="sbd-muted" style="font-size:14px;line-height:1.5;color:${C.ink2};margin:16px 0 0;word-break:break-all;">Or paste this link into any browser:<br>${esc(m.button.url)}</p>
  ${foot}
</td></tr>
<tr><td class="sbd-bg" style="background-color:${C.plaster};padding:16px 20px;">
  <p class="sbd-fm sbd-muted" style="font-family:${FONT_MONO};font-size:14px;color:${C.ink2};margin:0;">${esc(MAILING_ADDRESS)}</p>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;

  const text = [
    "SB DAYMAKER",
    "",
    ...(m.cadence ? [CADENCE_LINE, ""] : []),
    m.heading,
    "",
    ...m.paragraphs.flatMap((p) => [p, ""]),
    `${m.button.label}: ${m.button.url}`,
    "",
    ...(m.footNote ? [m.footNote.replace("{unsubscribe}", m.unsubscribeUrl ? `unsubscribe (${m.unsubscribeUrl})` : "unsubscribe"), ""] : []),
    MAILING_ADDRESS,
  ].map(stripEmDashes).join("\n");

  return { html, text };
}
