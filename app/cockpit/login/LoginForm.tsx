"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";
import { Button } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const supabase = getBrowserSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/cockpit");
    router.refresh();
  };

  return (
    <form className="sbd-form" onSubmit={submit}>
      <label className="sbd-field">
        <span className="sbd-field__label">Email</span>
        <input
          type="email"
          className="sbd-field__input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="sbd-field">
        <span className="sbd-field__label">Password</span>
        <input
          type="password"
          className="sbd-field__input"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>
      {error ? <p className="sbd-field__error">{error}</p> : null}
      <Button type="submit" variant="primary" block disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
