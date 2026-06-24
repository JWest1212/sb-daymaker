import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Cockpit — sign in",
  robots: { index: false, follow: false },
};

export default function CockpitLoginPage() {
  return (
    <main className="sbd-public">
      <div className="sbd-public__inner" style={{ maxWidth: 380 }}>
        <p className="sbd-public__eyebrow">SB Daymaker · admin</p>
        <h1 className="sbd-public__title">Cockpit</h1>
        <p className="sbd-public__desc">Sign in to review and publish content.</p>
        <LoginForm />
      </div>
    </main>
  );
}
