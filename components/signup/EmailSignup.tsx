"use client";

import { useEffect, useId, useRef, useState } from "react";
import { trackEvent } from "@/lib/analytics";
import { CADENCE_LINE, NEWSLETTER_HEADING } from "@/lib/strings";

type Status = "idle" | "busy" | "done" | "already" | "error";

/** R1 W7.6. The site's own check, so the message is ours and not the browser
 *  bubble's. Exported for the test. */
export function emailProblem(raw: string): string | null {
  const v = raw.trim();
  if (!v) return "Type your email address.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) return "That doesn't look like an email address.";
  return null;
}

export function EmailSignup() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [problem, setProblem] = useState<string | null>(null);
  const errId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  // Set when "Not you? Try another." swaps the form back in, so focus lands in
  // the field it exists to reopen rather than dropping to the page (review fix).
  const refocus = useRef(false);
  useEffect(() => {
    if (status === "idle" && refocus.current) {
      refocus.current = false;
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [status]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // R1 W7.6. Inline, in the site's styling. The browser bubble stays off
    // (noValidate) so the two cannot disagree.
    const p = emailProblem(email);
    setProblem(p);
    if (p) {
      // With the browser bubble off, put the visitor back in the field; the
      // error below is announced (role="alert") and described by it.
      inputRef.current?.focus();
      return;
    }
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
      <h2 className="sbd-signup__title">{NEWSLETTER_HEADING}</h2>
      <p className="sbd-signup__desc">
        The pick of what&rsquo;s on, a few more worth your time, and one evergreen spot.
        {" "}{CADENCE_LINE}. No wall, unsubscribe anytime.
      </p>
      <p className="sbd-signup__proof">
        <a className="sbd-signup__sample" href="/digest/sample">See a sample issue →</a>
      </p>

      {status === "done" || status === "already" ? (
        // R1 W7.6. The address stays on screen so a typo can be fixed, and the
        // message is the same whether or not the address was already on the
        // list: the page never says who is subscribed.
        <div className="sbd-signup__ok" role="status">
          <p className="sbd-signup__okline">✓ Almost there, check your inbox to confirm.</p>
          <p className="sbd-signup__sent">
            Sent to <b>{email.trim()}</b>.{" "}
            <button
              type="button"
              className="sbd-signup__retry"
              onClick={() => {
                refocus.current = true;
                setStatus("idle");
                setProblem(null);
              }}
            >
              Not you? Try another.
            </button>
          </p>
        </div>
      ) : (
        <form className="sbd-signup__form" onSubmit={submit} noValidate>
          <input
            ref={inputRef}
            type="email"
            className={`sbd-signup__input${problem ? " has-error" : ""}`}
            placeholder="you@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (problem) setProblem(null);
            }}
            aria-label="Your email"
            aria-invalid={!!problem}
            aria-describedby={problem ? errId : undefined}
            autoComplete="email"
            inputMode="email"
          />
          <button
            type="submit"
            className="sbd-btn sbd-btn--primary"
            disabled={status === "busy"}
            aria-busy={status === "busy"}
          >
            {status === "busy" ? "Sending..." : "Subscribe"}
          </button>
        </form>
      )}
      {problem ? (
        <p className="sbd-signup__err" id={errId} role="alert">{problem}</p>
      ) : status === "error" ? (
        <p className="sbd-signup__err">Something went wrong, please try again.</p>
      ) : null}
    </section>
  );
}
