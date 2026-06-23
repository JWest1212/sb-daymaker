"use client";

import { useState } from "react";
import { Button, SegmentedControl } from "@/components/ui";
import { submitThing } from "@/lib/submissions";

type Status = "idle" | "busy" | "done" | "error";

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

  const set =
    (k: keyof typeof f) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setF((p) => ({ ...p, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!f.name.trim()) return;
    setStatus("busy");
    const ok = await submitThing({ kind, ...f, consent });
    setStatus(ok ? "done" : "error");
  };

  if (status === "done") {
    return (
      <div className="sbd-form__done">
        <div className="sbd-form__done-icon" aria-hidden="true">
          🎉
        </div>
        <h2 className="sbd-form__done-title">Thanks — got it!</h2>
        <p>
          We&rsquo;ll take a look. The best submissions get featured in the
          weekend digest.
        </p>
      </div>
    );
  }

  return (
    <form className="sbd-form" onSubmit={submit}>
      <SegmentedControl
        ariaLabel="What are you adding?"
        value={kind}
        onChange={(v) => setKind(v as "event" | "business")}
        options={[
          { label: "An event", value: "event" },
          { label: "A business", value: "business" },
        ]}
      />

      <label className="sbd-field">
        <span className="sbd-field__label">
          {kind === "event" ? "Event name" : "Business name"}
        </span>
        <input className="sbd-field__input" value={f.name} onChange={set("name")} required />
      </label>

      <label className="sbd-field">
        <span className="sbd-field__label">Where (venue or address)</span>
        <input className="sbd-field__input" value={f.where} onChange={set("where")} />
      </label>

      {kind === "event" ? (
        <label className="sbd-field">
          <span className="sbd-field__label">When (date &amp; time)</span>
          <input className="sbd-field__input" value={f.when} onChange={set("when")} />
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

      <label className="sbd-field">
        <span className="sbd-field__label">Your email (optional, if we have questions)</span>
        <input
          type="email"
          className="sbd-field__input"
          value={f.submitterEmail}
          onChange={set("submitterEmail")}
        />
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
        <p className="sbd-field__error">Something went wrong — please try again.</p>
      ) : null}

      <Button type="submit" variant="cta" block disabled={status === "busy"}>
        {status === "busy" ? "Sending…" : "Submit"}
      </Button>
    </form>
  );
}
