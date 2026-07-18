import { createClient } from "@supabase/supabase-js";
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
  auth: { persistSession: false },
});
const { data, error } = await sb
  .from("things")
  .select("id, title, status, starts_at, address, source, data_confidence, source_count, blurb")
  .ilike("source", "%carrwinery.com%");
if (error) { console.error(error); process.exit(1); }
console.log(JSON.stringify(data, null, 2));
