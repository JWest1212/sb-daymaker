"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { getServerSupabase } from "@/lib/supabaseServer";
import { runNightly } from "@/lib/pipeline";

async function requireUser() {
  const sb = await getServerSupabase();
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) throw new Error("unauthorized");
  return user;
}

async function setStatus(
  id: string,
  status: "published" | "archived",
  action: "approve" | "reject",
) {
  await requireUser();
  const sb = getAdminSupabase();
  if (!sb) throw new Error("SUPABASE_SECRET_KEY not configured");
  await sb.from("things").update({ status }).eq("id", id);
  await sb
    .from("audit_log")
    .insert({ entity_type: "thing", entity_id: id, action, actor: "founder" });
  revalidatePath("/cockpit");
  revalidatePath("/");
}

export async function approveThing(id: string) {
  await setStatus(id, "published", "approve");
}

export async function rejectThing(id: string) {
  await setStatus(id, "archived", "reject");
}

export async function runPipeline() {
  await requireUser();
  await runNightly();
  revalidatePath("/cockpit");
}

export async function signOut() {
  const sb = await getServerSupabase();
  await sb.auth.signOut();
  redirect("/cockpit/login");
}
