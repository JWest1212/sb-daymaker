"use client";

import { useState } from "react";
import { trackEvent } from "@/lib/analytics";

type Status = "idle" | "busy" | "done" | "already" | "error";

export function EmailSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("busy");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) setStatus("error");
      else {
        const already = data.status === "already";
        setStatus(already ? "already" : "done");
        // Event 7: a subscribe succeeded. Status only, never the email.
        trackEvent("subscribe_submit", { status: already ? "already" : "pending" });
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <section className="sbd-signup">
      <h2 className="sbd-signup__title">The weekend, in your inbox</h2>
      <p className="sbd-signup__desc">
        Two emails a week, what&rsquo;s new and what&rsquo;s coming up. No wall,
        unsubscribe anytime.
      </p>

      {status === "done" ? (
        <p className="sbd-signup__ok">
          ✓ Almost there, check your inbox to confirm.
        </p>
      ) : status === "already" ? (
        <p className="sbd-signup__ok">✓ You&rsquo;re already subscribed.</p>
      ) : (
        <form className="sbd-signup__form" onSubmit={submit}>
          <input
            type="email"
            className="sbd-signup__input"
            placeholder="you@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-label="Your email"
            required
          />
          <button
            type="submit"
            className="sbd-btn sbd-btn--primary"
            disabled={status === "busy"}
          >
            {status === "busy" ? "…" : "Subscribe"}
          </button>
        </form>
      )}
      {status === "error" ? (
        <p className="sbd-signup__err">Something went wrong, please try again.</p>
      ) : null}
    </section>
  );
}
