// publish_state_street.mjs — final stop-and-show step: set now_note/now_note_on
// per Jim's go-ahead (2026-07-08) and flip the guide live.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const GUIDE_ID = "483ec84a-c031-56e0-b9fd-5a2a98f90182";

const env = Object.fromEntries(
  readFileSync("./.env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const { error } = await sb
  .from("guides")
  .update({
    now_note: "The long July evenings are the reward down here. Do the sights while it is light, then let the walk end slow on a Presidio patio as the heat lets go.",
    now_note_on: "2026-07-08",
    status: "published",
  })
  .eq("id", GUIDE_ID);

if (error) {
  console.error("❌ publish failed:", error.message);
  process.exit(1);
}

const { data } = await sb
  .from("guides")
  .select("title, status, now_note, now_note_on")
  .eq("id", GUIDE_ID)
  .single();
console.log("✅ live:", JSON.stringify(data, null, 2));
