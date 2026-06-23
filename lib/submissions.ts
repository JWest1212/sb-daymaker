import { getSupabase } from "./supabase";

export interface SubmitPayload {
  kind: "event" | "business";
  name: string;
  where: string;
  when: string;
  price: string;
  caption: string;
  submitterName: string;
  submitterEmail: string;
  consent: boolean;
}

/** Public submission → lands in `submissions` (status 'new') via RPC. */
export async function submitThing(p: SubmitPayload): Promise<boolean> {
  const sb = getSupabase();
  if (!sb) return false;
  const { error } = await sb.rpc("submit_thing", {
    p_kind: p.kind,
    p_payload: {
      name: p.name,
      where: p.where,
      when: p.when,
      price: p.price,
      caption: p.caption,
    },
    p_name: p.submitterName,
    p_email: p.submitterEmail,
    p_consent: p.consent,
  });
  return !error;
}
