"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";

/** Magic-link save-restore: POSTs a snapshot keyed by the user's own email; the
 *  server stores it (SECURITY DEFINER RPC) and emails back the restore link,
 *  keeping the on-screen link as a copy/paste fallback. Degrades gracefully when
 *  Resend isn't domain-verified yet (sent:false → copy-the-link experience). */
export function RestorePanel() {
  const { asMap, counts } = useSaves();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/restore-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), saves: asMap() }),
      });
      const data = await res.json();
      if (!res.ok || !data.token) {
        setError("Couldn't create your link. Please try again.");
        return;
      }
      setLink(`${window.location.origin}/r/${data.token}`);
      setSent(Boolean(data.sent));
    } catch {
      setError("Couldn't reach the server. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  if (counts.total === 0) return null;

  return (
    <section className="sbd-restore">
      <h2 className="sbd-restore__title">You&apos;ve built a real list — back it up</h2>
      <p className="sbd-restore__desc">
        Saves live on this phone. Email yourself a link so they survive a cleared
        browser or a new device — no account, no password.
      </p>

      {link ? (
        <div className="sbd-restore__result" aria-live="polite">
          <p className="sbd-restore__note">
            {sent
              ? "Check your inbox — we sent your restore link. Open it on any device to bring your saves back, or copy it now."
              : "Email isn't set up yet — copy your link instead. Open it on another device to bring your saves over."}
          </p>
          <code className="sbd-restore__link">{link}</code>
          <Button
            variant="secondary"
            onClick={() => navigator.clipboard?.writeText(link)}
          >
            Copy link
          </Button>
        </div>
      ) : (
        <div className="sbd-restore__form">
          <input
            type="email"
            className="sbd-restore__input"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Your email"
          />
          <Button variant="primary" onClick={submit} disabled={busy}>
            {busy ? "Sending…" : "Email me a link to restore"}
          </Button>
          {error ? (
            <p className="sbd-restore__error" aria-live="polite">{error}</p>
          ) : null}
        </div>
      )}
    </section>
  );
}
