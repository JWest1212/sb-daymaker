"use client";

import { useState } from "react";
import { Button } from "@/components/ui";
import { useSaves } from "@/components/saves/SavesProvider";
import { createSaveRestore } from "@/lib/shares";

/** Magic-link save-restore: writes a snapshot keyed by the user's own email and
 *  returns a restore link. (Email delivery is wired up in Phase 7 — for now the
 *  link is shown to copy / open on another device.) */
export function RestorePanel() {
  const { asMap, counts } = useSaves();
  const [email, setEmail] = useState("");
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    setError(null);
    const token = await createSaveRestore(email.trim(), asMap());
    setBusy(false);
    if (!token) {
      setError("Couldn't create your link. Please try again.");
      return;
    }
    setLink(`${window.location.origin}/r/${token}`);
  };

  if (counts.total === 0) return null;

  return (
    <section className="sbd-restore">
      <h2 className="sbd-restore__title">Back up your saves</h2>
      <p className="sbd-restore__desc">
        Saves live on this device. Get a link to restore them on another phone or
        browser — no account needed.
      </p>

      {link ? (
        <div className="sbd-restore__result">
          <p className="sbd-restore__note">
            Your restore link is ready. Open it on another device to bring your
            saves over. (Emailing it to you arrives in a later step.)
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
            {busy ? "Creating…" : "Email me a link to restore"}
          </Button>
          {error ? <p className="sbd-restore__error">{error}</p> : null}
        </div>
      )}
    </section>
  );
}
