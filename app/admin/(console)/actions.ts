"use server";

import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabaseServer";

// QW7, a cockpit-scoped sign-out. Deliberately not shared with the old
// app/cockpit/actions.ts (now deleted, D6), which belonged to the pre-cockpit
// /cockpit surface.
export async function signOutOfCockpit() {
  const sb = await getServerSupabase();
  await sb.auth.signOut();
  redirect("/admin/login");
}
