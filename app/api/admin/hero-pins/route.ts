import { NextResponse } from "next/server";
import { getAdminUser, revalidatePublic } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import { loadHeroPlan, validatePin } from "@/lib/heroServer";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getAdminUser();
  return user ? getAdminSupabase() : null;
}

// GET -> next-14-days rail: pins (+validity), Auto picks, per-day candidates.
export async function GET() {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await loadHeroPlan());
}

// POST { pin_date, thing_id } -> pin a hero for that day (validated). Upsert on pin_date.
export async function POST(req: Request) {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { pin_date, thing_id } = (await req.json()) as { pin_date?: string; thing_id?: string };
  if (!pin_date || !thing_id) return NextResponse.json({ error: "pin_date + thing_id required" }, { status: 400 });

  const check = await validatePin(pin_date, thing_id);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });

  const { error } = await sb.from("hero_pins").upsert({ pin_date, thing_id }, { onConflict: "pin_date" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "hero_pin", entity_id: thing_id, action: "hero_pin", actor: "founder",
    payload: { pin_date, thing_id },
  });
  revalidatePublic(); // a pin for today changes the live Explore hero
  return NextResponse.json({ ok: true });
}

// DELETE { pin_date } -> clear the pin (back to Auto).
export async function DELETE(req: Request) {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { pin_date } = (await req.json()) as { pin_date?: string };
  if (!pin_date) return NextResponse.json({ error: "pin_date required" }, { status: 400 });

  const { error } = await sb.from("hero_pins").delete().eq("pin_date", pin_date);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await sb.from("audit_log").insert({
    entity_type: "hero_pin", entity_id: null, action: "hero_unpin", actor: "founder",
    payload: { pin_date },
  });
  revalidatePublic();
  return NextResponse.json({ ok: true });
}
