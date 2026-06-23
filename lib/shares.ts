import { getSupabase } from "./supabase";
import type { SaveState } from "@/components/saves/SavesProvider";

// Isomorphic wrappers around the shared_states RPC API (shared_states_rpc.sql).
// Reads/writes go through SECURITY DEFINER functions, so the publishable key is
// all that's needed — the table stays locked.

export interface SharedStateResult {
  kind: "shared_list" | "save_restore";
  payload: { ids?: string[]; saves?: Record<string, SaveState> };
}

export async function createSharedList(ids: string[]): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("create_shared_list", {
    p_payload: { ids },
  });
  if (error || !data) return null;
  return data as string;
}

export async function createSaveRestore(
  email: string,
  saves: Record<string, SaveState>,
): Promise<string | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("create_save_restore", {
    p_email: email,
    p_payload: { saves },
  });
  if (error || !data) return null;
  return data as string;
}

export async function getSharedState(
  token: string,
): Promise<SharedStateResult | null> {
  const sb = getSupabase();
  if (!sb) return null;
  const { data, error } = await sb.rpc("get_shared_state", { p_token: token });
  if (error || !data) return null;
  return data as SharedStateResult;
}
