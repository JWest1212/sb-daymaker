"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserSupabase } from "@/lib/supabaseBrowser";

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
      // Logged for debugging, never shown to the founder: the raw Supabase
      // message ("Invalid login credentials") reads like a bug report, not
      // a login form.
      console.error("[admin login] sign-in failed:", error.message);
      setError("That sign-in didn't work. Check the email and password.");
      return;
    }
    router.push("/admin/today");
    router.refresh();
  };

  return (
    <form className="logincard" onSubmit={submit}>
      <div className="eyebrow">SB Daymaker &middot; Admin</div>
      <h1><span className="sb">SB</span> Cockpit</h1>
      <p className="sub">Sign in to review and publish content.</p>
      <div className="field">
        <label htmlFor="admin-login-email">Email</label>
        <input
          id="admin-login-email" type="email" required
          value={email} onChange={(e) => setEmail(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="admin-login-password">Password</label>
        <input
          id="admin-login-password" type="password" required
          value={password} onChange={(e) => setPassword(e.target.value)}
        />
      </div>
      {error ? <p className="login-error">{error}</p> : null}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
