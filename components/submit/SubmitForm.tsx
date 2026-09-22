"use client";

import { useRef, useState } from "react";
import { Button, SegmentedControl, SBIcon } from "@/components/ui";
import { submitThing } from "@/lib/submissions";

type Status = "idle" | "busy" | "done" | "error";

/**
 * R1 W7.5 (FRM-001). What each field needs, and the sentence to say when it is
 * missing. Exported so the rule is testable without a DOM.
 *
 * `name` and `where` are the two things a local cannot review without; the rest
 * is welcome. An email is only checked when one is typed.
 */
export type SubmitFields = { name: string; where: string; when: string; submitterEmail: string };
export function submitProblems(f: SubmitFields, kind: "event" | "business"): Partial<Record<keyof SubmitFields, string>> {
  const out: Partial<Record<keyof SubmitFields, string>> = {};
  if (!f.name.trim()) out.name = kind === "event" ? "Give the event a name." : "Give the business a name.";
  if (!f.where.trim()) out.where = "Say where it is, a venue or an address.";
  if (kind === "event" && !f.when.trim()) out.when = "Say when it is.";
  const email = f.submitterEmail.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) out.submitterEmail = "That email doesn't look right.";
  return out;
}

export function SubmitForm() {
  const [kind, setKind] = useState<"event" | "business">("event");
  const [f, setF] = useState({
    name: "",
    where: "",
    when: "",
    price: "",
    caption: "",
    submitterName: "",
    submitterEmail: "",
  });
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<Status>("idle");
  const [problems, setProblems] = useState<Partial<Record<keyof SubmitFields, string>>>({});
  const formRef = useRef<HTMLFormElement>(null);

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    // R1 W7.5 (FRM-001). An empty submit used to do nothing at all: no message,
    // no field marked, the button still lit. Now every gap is named inline and
    // the page scrolls to the first one.
    const found = submitProblems(f, kind);
    setProblems(found);
    const first = (Object.keys(found) as (keyof SubmitFields)[])[0];
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
      el?.focus({ preventScroll: true });
      return;
    }
    setStatus("busy");
    const ok = await submitThing({ kind, ...f, consent });
    setStatus(ok ? "done" : "error");
  };

  const clearProblem = (k: keyof SubmitFields) =>
    setProblems((p) => (p[k] ? { ...p, [k]: undefined } : p));

  const errorId = (k: keyof SubmitFields) => (problems[k] ? `submit-${k}-error` : undefined);

  if (status === "done") {
    // R1 W7.5. The timing the intro promises, said again here; the icon-set
    // check instead of a party emoji.
    return (
      <div className="sbd-form__done" role="status">
        <div className="sbd-form__done-icon" aria-hidden="true">
          <SBIcon name="check" size={32} strokeWidth={2.2} />
        </div>
        <h2 className="sbd-form__done-title">Thanks, got it.</h2>
        <p>
          A local reads every submission within a few days. The best ones get
          featured in the newsletter.
        </p>
      </div>
    );
  }

  return (
    <form className="sbd-form" onSubmit={submit} ref={formRef} noValidate>
      <p className="sbd-form__req" id="submit-required-note">Fields marked * are required.</p>
      <SegmentedControl
        ariaLabel="What are you adding?"
        value={kind}
        onChange={(v) => {
          const next = v as "event" | "business";
          setKind(next);
          // Review fix: errors already on screen are re-said for the new kind
          // ("Give the business a name.", and no "when" for a business).
          setProblems((p) => (Object.keys(p).some((k) => p[k as keyof SubmitFields]) ? submitProblems(f, next) : p));
        }}
        options={[
          { label: "An event", value: "event" },
          { label: "A business", value: "business" },
        ]}
      />

      <label className={`sbd-field${problems.name ? " has-error" : ""}`}>
        <span className="sbd-field__label">
          {kind === "event" ? "Event name" : "Business name"} <span className="sbd-field__req" aria-hidden="true">*</span>
        </span>
        <input
          className="sbd-field__input"
          name="name"
          value={f.name}
          onChange={(e) => { set("name")(e); clearProblem("name"); }}
          required
          aria-required="true"
          aria-invalid={!!problems.name}
          aria-describedby={errorId("name")}
        />
        {problems.name ? <span className="sbd-field__error" id="submit-name-error">{problems.name}</span> : null}
      </label>

      <label className={`sbd-field${problems.where ? " has-error" : ""}`}>
        <span className="sbd-field__label">Where (venue or address) <span className="sbd-field__req" aria-hidden="true">*</span></span>
        <input
          className="sbd-field__input"
          name="where"
          value={f.where}
          onChange={(e) => { set("where")(e); clearProblem("where"); }}
          required
          aria-required="true"
          aria-invalid={!!problems.where}
          aria-describedby={errorId("where")}
        />
        {problems.where ? <span className="sbd-field__error" id="submit-where-error">{problems.where}</span> : null}
      </label>

      {kind === "event" ? (
        <label className={`sbd-field${problems.when ? " has-error" : ""}`}>
          <span className="sbd-field__label">When (date &amp; time) <span className="sbd-field__req" aria-hidden="true">*</span></span>
          <input
            className="sbd-field__input"
            name="when"
            value={f.when}
            onChange={(e) => { set("when")(e); clearProblem("when"); }}
            required
            aria-required="true"
            aria-invalid={!!problems.when}
            aria-describedby={errorId("when")}
          />
          {problems.when ? <span className="sbd-field__error" id="submit-when-error">{problems.when}</span> : null}
        </label>
      ) : null}

      <label className="sbd-field">
        <span className="sbd-field__label">Price (or “free”)</span>
        <input className="sbd-field__input" value={f.price} onChange={set("price")} />
      </label>

      <label className="sbd-field">
        <span className="sbd-field__label">
          Anything else? (paste an Instagram caption and we&rsquo;ll pull details)
        </span>
        <textarea
          className="sbd-field__input"
          rows={4}
          value={f.caption}
          onChange={set("caption")}
        />
      </label>

      <label className="sbd-field">
        <span className="sbd-field__label">Your name (optional)</span>
        <input
          className="sbd-field__input"
          value={f.submitterName}
          onChange={set("submitterName")}
        />
      </label>

      <label className={`sbd-field${problems.submitterEmail ? " has-error" : ""}`}>
        <span className="sbd-field__label">Your email (optional, if we have questions)</span>
        <input
          type="email"
          className="sbd-field__input"
          name="submitterEmail"
          value={f.submitterEmail}
          onChange={(e) => { set("submitterEmail")(e); clearProblem("submitterEmail"); }}
          aria-invalid={!!problems.submitterEmail}
          aria-describedby={errorId("submitterEmail")}
        />
        {problems.submitterEmail ? (
          <span className="sbd-field__error" id="submit-submitterEmail-error">{problems.submitterEmail}</span>
        ) : null}
      </label>

      <label className="sbd-field__check">
        <input
          type="checkbox"
          checked={consent}
          onChange={(e) => setConsent(e.target.checked)}
        />
        <span>It&rsquo;s OK to contact me about this submission.</span>
      </label>

      {status === "error" ? (
        <p className="sbd-field__error">Something went wrong, please try again.</p>
      ) : null}

      <Button type="submit" variant="cta" block disabled={status === "busy"} aria-busy={status === "busy"}>
        {status === "busy" ? "Sending..." : "Submit"}
      </Button>
    </form>
  );
}
