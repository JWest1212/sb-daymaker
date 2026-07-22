import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "Cockpit, sign in",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default function AdminLoginPage() {
  return (
    <div className="loginstage">
      <LoginForm />
    </div>
  );
}
