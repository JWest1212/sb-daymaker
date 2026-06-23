-- ============================================================================
-- SB Daymaker — shared_states RPC API (Phase 5)
-- Controlled access to shared_states using only the PUBLISHABLE key.
-- The table itself has NO public RLS policies; these SECURITY DEFINER functions
-- are the only door. Run this once in the Supabase SQL Editor ("without RLS").
-- ============================================================================

-- Create a view-only shared list (kind='shared_list'). Payload = { ids: [...] }.
-- No recipient PII is ever stored.
create or replace function create_shared_list(p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_payload is null or jsonb_typeof(p_payload -> 'ids') <> 'array' then
    raise exception 'payload must include an ids array';
  end if;
  v_token := replace(gen_random_uuid()::text, '-', '');
  insert into shared_states (token, kind, payload, email)
  values (v_token, 'shared_list', p_payload, null);
  return v_token;
end;
$$;

-- Create/refresh a magic-link save-restore record (kind='save_restore').
-- Keyed by the user's OWN email; token stays stable, payload overwrites.
create or replace function create_save_restore(p_email citext, p_payload jsonb)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token text;
begin
  if p_email is null or length(trim(p_email::text)) = 0 then
    raise exception 'email required';
  end if;
  select token into v_token
    from shared_states
    where kind = 'save_restore' and email = p_email
    limit 1;
  if v_token is null then
    v_token := replace(gen_random_uuid()::text, '-', '');
    insert into shared_states (token, kind, payload, email)
    values (v_token, 'save_restore', coalesce(p_payload, '{}'::jsonb), p_email);
  else
    update shared_states
      set payload = coalesce(p_payload, '{}'::jsonb), last_accessed_at = now()
      where token = v_token;
  end if;
  return v_token;
end;
$$;

-- Read a token's payload (and bump sliding expiry). Returns kind + payload only
-- (never echoes the stored email).
create or replace function get_shared_state(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind shared_state_kind;
  v_payload jsonb;
begin
  update shared_states
    set last_accessed_at = now()
    where token = p_token
    returning kind, payload into v_kind, v_payload;
  if v_kind is null then
    return null;
  end if;
  return jsonb_build_object('kind', v_kind, 'payload', v_payload);
end;
$$;

grant execute on function create_shared_list(jsonb) to anon, authenticated;
grant execute on function create_save_restore(citext, jsonb) to anon, authenticated;
grant execute on function get_shared_state(text) to anon, authenticated;
