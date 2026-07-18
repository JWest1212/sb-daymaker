import { NextResponse } from "next/server";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import type { EditionSlot } from "@/lib/edition/types";
import { rehostImage } from "@/lib/edition/imageHost";
import { ensureBlurbs, ensureImageOptions } from "@/lib/edition/draft";

export const dynamic = "force-dynamic";

async function requireAdmin() {
  const user = await getAdminUser();
  return user ? getAdminSupabase() : null;
}

const VALID_SLOTS: EditionSlot[] = ["hero", "secondary", "nonevent", "anchor"];

interface SwapBody {
  slot: EditionSlot;
  position?: number; // secondary only; defaults to 0 for single-item slots
  thingId: string;
}

// POST, promote a candidate (from the ranked bench, or any published thing
// via search-all) into a slot position. Resets overrides on the new pick
// (they belonged to whatever thing was there before) and flips is_manual.
// Cooldown is deliberately not consulted here, an explicit operator swap is
// the documented cooldown override (spec §3.6).
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const sb = await requireAdmin();
  if (!sb) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id: editionId } = await params;

  const { data: edition, error: edErr } = await sb.from("editions").select("status").eq("id", editionId).maybeSingle();
  if (edErr || !edition) return NextResponse.json({ error: "edition not found" }, { status: 404 });
  if (!["draft", "approved", "skipped"].includes(edition.status)) {
    return NextResponse.json({ error: `edition is ${edition.status}, no longer editable` }, { status: 400 });
  }

  const body = (await req.json()) as SwapBody;
  if (!VALID_SLOTS.includes(body.slot) || !body.thingId) {
    return NextResponse.json({ error: "slot + thingId required" }, { status: 400 });
  }
  const position = body.slot === "secondary" ? (body.position ?? 0) : 0;

  const { data: thing, error: thingErr } = await sb
    .from("things")
    .select("id, type, title, blurb, photo_url, photo_options, happening_tier, happening_category, neighborhood")
    .eq("id", body.thingId)
    .eq("status", "published")
    .maybeSingle();
  if (thingErr || !thing) return NextResponse.json({ error: "thing not found or not published" }, { status: 400 });

  // A swapped-in thing may be a bench candidate or an ad-hoc search-all pick, // neither goes through draftEdition()'s initial pass, so it may still be
  // missing a blurb or short on image options. Same guarantee as a fresh draft,
  // just scoped to this one thing (see draft.ts for the fuller rationale).
  await ensureBlurbs(sb, [thing]);
  await ensureImageOptions(sb, [thing]);

  const hostedUrl = await rehostImage(sb, thing.photo_url);

  const { data: existingPick } = await sb
    .from("edition_picks")
    .select("id, thing_id")
    .eq("edition_id", editionId)
    .eq("slot", body.slot)
    .eq("position", position)
    .maybeSingle();

  if (existingPick) {
    const { error } = await sb
      .from("edition_picks")
      .update({
        thing_id: thing.id,
        cached_image_url: hostedUrl,
        is_manual: true,
        override_title: null, override_blurb: null, override_when: null,
        override_neighborhood: null, override_local_note: null, override_image_url: null,
      })
      .eq("id", existingPick.id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    const { error } = await sb.from("edition_picks").insert({
      edition_id: editionId, slot: body.slot, position, thing_id: thing.id,
      cached_image_url: hostedUrl, is_manual: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Flip the candidate-bench selection flags so the swap UI reflects reality.
  if (existingPick && existingPick.thing_id !== thing.id) {
    await sb.from("edition_candidates")
      .update({ selected: false })
      .eq("edition_id", editionId).eq("slot", body.slot).eq("thing_id", existingPick.thing_id);
  }
  const { data: newCandidate } = await sb
    .from("edition_candidates")
    .select("thing_id")
    .eq("edition_id", editionId).eq("slot", body.slot).eq("thing_id", thing.id)
    .maybeSingle();
  if (newCandidate) {
    await sb.from("edition_candidates")
      .update({ selected: true })
      .eq("edition_id", editionId).eq("slot", body.slot).eq("thing_id", thing.id);
  } else {
    // Ad-hoc pick via search-all, wasn't in the original ranked bench.
    // rank -1 marks it as manually inserted rather than ranker-suggested.
    await sb.from("edition_candidates").insert({
      edition_id: editionId, slot: body.slot, thing_id: thing.id, rank: -1, selected: true,
    });
  }

  await sb.from("audit_log").insert({
    entity_type: "edition_pick", entity_id: editionId, action: "edition_swap", actor: "founder",
    payload: { slot: body.slot, position, thing_id: thing.id, thing_title: thing.title },
  });

  return NextResponse.json({ ok: true });
}
