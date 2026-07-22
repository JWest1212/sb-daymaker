import { redirect } from "next/navigation";

// D6, login moved to /admin/login (cockpit-styled, part of the same admin
// route tree). This legacy URL just forwards; force-dynamic so it resolves
// per-request rather than being collapsed at build.
export const dynamic = "force-dynamic";

export default function CockpitLoginRedirect() {
  redirect("/admin/login");
}
