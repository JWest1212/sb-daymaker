import Anthropic from "@anthropic-ai/sdk";
import { OCCASIONS } from "./occasions";

// The 16 happening_category enum values (from sbdaymaker_schema.sql).
const CATEGORIES = [
  "live_music", "festival_fair", "arts_theater", "community_gathering",
  "food_drink_event", "sports_outdoors_event", "weekly_special",
  "recurring_nightlife", "recurring_market", "recurring_arts",
  "recurring_outdoors", "outdoor_activity", "food_drink_spot",
  "culture_spot", "shopping_browse", "scenic_chill",
];
const OCCASION_KEYS = OCCASIONS.map((o) => o.key);

export interface EnrichFacts {
  title: string;
  type: string;
  neighborhood: string | null;
  address: string | null;
  price_band: string | null;
  free: boolean | null;
  starts_at: string | null;
  is_21_plus: boolean;
  indoor: boolean;
}

export interface EnrichResult {
  blurb: string;
  blurb_long: string;
  reason_to_go: string;
  local_note: string;
  happening_category: string;
  tags: string[];
  confidence: number;
}

const SYSTEM = `You write SB Daymaker's editorial copy for Santa Barbara listings.
Use ONLY the facts provided. You must NEVER invent or alter a name, address, date,
time, or price, those facts are fixed. Your job is voice + classification only.
- blurb: 1-2 sentences, warm "knowing local friend" voice, never breathless or corporate.
- blurb_long: 2-4 sentences for the detail screen, same voice.
- reason_to_go: one short phrase, why go.
- local_note: ONE insider tip ONLY if it genuinely follows from the given facts;
  otherwise return an empty string. Do not fabricate insider knowledge.
- happening_category: choose from the allowed list.
- tags: 1-3 occasion tags from the allowed list.
- confidence: 0-1; lower it when the facts are thin or ambiguous.
Respond by calling the enrich tool, nothing else.`;

/** Enrich one thing's facts via Haiku (strict tool). Returns null on any failure. */
export async function enrichThing(facts: EnrichFacts): Promise<EnrichResult | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey, maxRetries: 1, timeout: 30_000 });

  const tool: Anthropic.Tool = {
    name: "enrich",
    description: "Return only the editorial + classification fields for this listing.",
    strict: true,
    input_schema: {
      type: "object",
      additionalProperties: false,
      properties: {
        blurb: { type: "string" },
        blurb_long: { type: "string" },
        reason_to_go: { type: "string" },
        local_note: { type: "string" },
        happening_category: { type: "string", enum: CATEGORIES },
        tags: { type: "array", items: { type: "string", enum: OCCASION_KEYS } },
        confidence: { type: "number" },
      },
      required: [
        "blurb", "blurb_long", "reason_to_go", "local_note",
        "happening_category", "tags", "confidence",
      ],
    },
  };

  try {
    const res = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 1024,
      system: SYSTEM,
      tools: [tool],
      tool_choice: { type: "tool", name: "enrich" },
      messages: [
        { role: "user", content: `Facts (JSON):\n${JSON.stringify(facts)}` },
      ],
    });
    const block = res.content.find((b) => b.type === "tool_use");
    if (!block || block.type !== "tool_use") return null;
    return block.input as EnrichResult;
  } catch {
    return null; // graceful fallback, skip & flag (caller leaves it as draft)
  }
}
