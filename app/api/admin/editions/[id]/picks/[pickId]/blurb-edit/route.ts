import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getAdminUser } from "@/lib/reviewServer";
import { getAdminSupabase } from "@/lib/supabaseAdmin";
import type { EditionSlot } from "@/lib/edition/types";

export const dynamic = "force-dynamic";

const MODEL = "claude-haiku-4-5";

// Mirrors ingest/enrich.ts's SYSTEM voice guidance verbatim (knowing local friend,
// no em dashes, sentence case, concrete over listy) so an ad-hoc cockpit edit never
// drifts from the batch-drafted voice. This is an operator-triggered single call,
// not send-time synthesis, same category as the existing "find more images" and
// image-relevance-guard calls already in this cockpit.
const SYSTEM = `You revise a single blurb for an SB Daymaker Santa Barbara listing, in
the house voice: a knowing local friend, telling you where they'd go. Warm, dry,
specific, a little understated. Never corporate, never breathless, never salesy. No
hype, no exclamation marks. Active voice, sentence case, plain verbs. Concrete,
sensory detail beats a list of themes or keywords. Never use an em dash, anywhere,
under any circumstances: use a period, comma, colon, semicolon, or parentheses instead.

You will be given the listing's title and category, its current blurb (which may be
empty), a target length for this slot, and an operator's instruction describing the
change to make. Apply ONLY the requested change. Keep the target length. Never invent
a fact (a time, price, address, or name) that was not already in the current blurb or
the listing's title/category.

Respond by calling revise_blurb with the full revised blurb text. Nothing else.`;

const reviseBlurbTool: Anthropic.Tool = {
  name: "revise_blurb",
  description: "Return the revised blurb text.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    properties: { blurb: { type: "string" } },
    required: ["blurb"],
  },
};

function targetLengthFor(slot: EditionSlot): string {
  return slot === "hero"
    ? "2 to 4 sentences (the hero gets a deliberately longer hook than the other slots)"
    : "1 to 2 sentences, about 24 words or fewer";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string; pickId: string }> },
) {
  const user = await getAdminUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sb = getAdminSupabase();
  if (!sb) return NextResponse.json({ error: "not configured" }, { status: 500 });
  const { id: editionId, pickId } = await params;

  const { instruction, currentBlurb } = (await req.json()) as { instruction?: string; currentBlurb?: string };
  if (!instruction?.trim()) return NextResponse.json({ error: "an instruction is required" }, { status: 400 });

  const { data: edition, error: edErr } = await sb.from("editions").select("status").eq("id", editionId).maybeSingle();
  if (edErr || !edition) return NextResponse.json({ error: "edition not found" }, { status: 404 });
  if (!["draft", "approved", "skipped"].includes(edition.status)) {
    return NextResponse.json({ error: `edition is ${edition.status}, no longer editable` }, { status: 400 });
  }

  const { data: pick, error: pickErr } = await sb
    .from("edition_picks").select("slot, thing_id").eq("id", pickId).eq("edition_id", editionId).maybeSingle();
  if (pickErr || !pick) return NextResponse.json({ error: "pick not found" }, { status: 404 });

  const { data: thing, error: thingErr } = await sb
    .from("things").select("title, happening_category").eq("id", pick.thing_id).maybeSingle();
  if (thingErr || !thing) return NextResponse.json({ error: "thing not found" }, { status: 404 });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "AI not configured" }, { status: 500 });

  try {
    const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 60_000 });
    const res = await client.messages.create({
      model: MODEL,
      max_tokens: 400,
      system: SYSTEM,
      tools: [reviseBlurbTool],
      tool_choice: { type: "tool", name: "revise_blurb" },
      messages: [{
        role: "user",
        content: `Listing: "${thing.title}" (${thing.happening_category})\n` +
          `Slot: ${pick.slot}, target length: ${targetLengthFor(pick.slot as EditionSlot)}\n` +
          `Current blurb: ${currentBlurb?.trim() || "(empty)"}\n` +
          `Operator instruction: ${instruction.trim()}`,
      }],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") {
      return NextResponse.json({ error: "Claude did not return a revision" }, { status: 502 });
    }
    const blurb = (block.input as { blurb?: string }).blurb?.trim();
    if (!blurb) return NextResponse.json({ error: "Claude returned an empty blurb" }, { status: 502 });
    return NextResponse.json({ ok: true, blurb });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `AI edit failed: ${msg}` }, { status: 502 });
  }
}
