// lib/edition/send.ts
//
// The send path (edition_build_spec.md §7). Only ever called from Next.js API
// routes (the send cron, and later a cockpit "send now" override), never the
// ingest worker — safe to mark server-only, unlike draft.ts.
//
// Renders ONCE (spec §0.6 / §6.1 — byte-identical per recipient except the
// unsubscribe link): the email HTML/text is built a single time with a
// sentinel token in place of the unsubscribe URL, then each recipient's real
// batch-send message is that same string with the sentinel substituted for
// their own token. No per-recipient re-render.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { loadRenderableEdition } from "./renderData";
import { renderEditionEmailHtml, renderEditionPlainText } from "./render";
import { stripEmDashes } from "./emdash";
import { sendEmailBatch } from "../email";

const UNSUB_SENTINEL = "__SBD_UNSUB_TOKEN__";
const BATCH_SIZE = 100; // Resend's per-call cap

export interface SendResult {
  ok: boolean;
  sent: number;
  skipReason?: string;
}

export async function sendEdition(sb: SupabaseClient, editionDate: string): Promise<SendResult> {
  const { data: ed, error: edErr } = await sb
    .from("editions")
    .select("id, status")
    .eq("edition_date", editionDate)
    .maybeSingle();
  if (edErr) throw new Error(`send: edition select failed: ${edErr.message}`);
  if (!ed) return { ok: false, sent: 0, skipReason: "no edition for this date" };

  // Spec §7.2: approved OR still-draft both send (auto-send-if-unapproved).
  // skipped/failed/sent are all terminal — never (re-)send them.
  if (!["draft", "approved"].includes(ed.status)) {
    return { ok: false, sent: 0, skipReason: `status is '${ed.status}' — not eligible to send` };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.sbdaymaker.com").replace(/\/+$/, "");
  const edition = await loadRenderableEdition(sb, editionDate, { siteUrl, unsubscribeToken: UNSUB_SENTINEL }, true);
  if (!edition) return { ok: false, sent: 0, skipReason: "could not render edition" };

  const subject = stripEmDashes(edition.subject); // belt-and-suspenders — an operator-edited subject may not be clean
  const htmlTemplate = renderEditionEmailHtml(edition);
  const textTemplate = renderEditionPlainText(edition);

  // Spec §7.3: confirmed subscribers only — excludes pending, unsubscribed,
  // bounced, complained by construction (not just convention).
  const { data: subs, error: subErr } = await sb
    .from("subscribers")
    .select("email, unsubscribe_token")
    .eq("status", "confirmed");
  if (subErr) throw new Error(`send: subscribers select failed: ${subErr.message}`);
  const recipients = subs ?? [];

  const nowIso = new Date().toISOString();
  if (!recipients.length) {
    await sb.from("editions").update({ status: "sent", sent_at: nowIso, sent_count: 0 }).eq("id", ed.id);
    return { ok: true, sent: 0 };
  }

  const allIds: string[] = [];
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const chunk = recipients.slice(i, i + BATCH_SIZE);
    const messages = chunk.map((r) => {
      const oneClickUrl = `${siteUrl}/api/unsubscribe?token=${r.unsubscribe_token}`;
      return {
        to: r.email as string,
        subject,
        html: htmlTemplate.replaceAll(UNSUB_SENTINEL, r.unsubscribe_token as string),
        text: textTemplate.replaceAll(UNSUB_SENTINEL, r.unsubscribe_token as string),
        headers: {
          "List-Unsubscribe": `<${oneClickUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
        tags: [{ name: "edition_id", value: ed.id }],
      };
    });
    const res = await sendEmailBatch(messages);
    if (res.ok) allIds.push(...res.ids);
  }

  await sb.from("editions").update({
    status: "sent",
    sent_at: nowIso,
    sent_count: recipients.length,
    resend_broadcast_id: allIds.slice(0, 50).join(","),
  }).eq("id", ed.id);

  return { ok: true, sent: recipients.length };
}
