// Minimal Resend sender (REST, no SDK dependency). Server-side only —
// RESEND_API_KEY is a secret. Returns false (no throw) when unconfigured.

const DEFAULT_FROM = "SB Daymaker <onboarding@resend.dev>";

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) return false;
  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, to, subject, html }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface BatchEmailMessage {
  to: string;
  subject: string;
  html: string;
  text?: string;
  headers?: Record<string, string>;
  tags?: { name: string; value: string }[];
}

/** Up to 100 independent messages per Resend API call (their hard cap) — the
 *  edition send path (lib/edition/send.ts) chunks larger recipient lists.
 *  Each message is otherwise fully independent (own `to`, same `html`/`text`
 *  body with the per-recipient unsubscribe token already substituted in). */
export async function sendEmailBatch(
  messages: BatchEmailMessage[],
): Promise<{ ok: boolean; ids: string[] }> {
  const key = process.env.RESEND_API_KEY;
  if (!key || !messages.length) return { ok: false, ids: [] };
  const from = process.env.RESEND_FROM || DEFAULT_FROM;
  try {
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(messages.map((m) => ({ from, ...m }))),
    });
    if (!res.ok) return { ok: false, ids: [] };
    const json = (await res.json()) as { data?: { id: string }[] };
    return { ok: true, ids: (json.data ?? []).map((d) => d.id) };
  } catch {
    return { ok: false, ids: [] };
  }
}
