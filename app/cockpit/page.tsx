import { redirect } from "next/navigation";

// The Phase-8 cockpit is superseded by the full review cockpit (Phase 12).
// force-dynamic so the redirect resolves per-request (not collapsed at build,
// which would bake in the unauthenticated outcome and misroute logged-in users).
export const dynamic = "force-dynamic";

export default function CockpitRedirect() {
  redirect("/admin/review");
}
