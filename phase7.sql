-- ============================================================================
-- SB Daymaker — Phase 7: detail note column + submissions/subscribers RPC API
-- Run once in the Supabase SQL Editor ("without RLS").
-- ============================================================================

-- 1) Local's-secret note on things (approved additive column) ---------------
alter table things add column if not exists local_note text;

-- A few sample notes so the detail page shows the callout on fixtures.
update things set local_note =
  'Parking by the harbor is tight — leave the car downtown and walk the last few blocks. Worth it for the sunset.'
  where id = '11111111-1111-4111-8111-111111111101';
update things set local_note =
  'Go right at golden hour. Start at the far end and walk back so the light is in front of you the whole way.'
  where id = '11111111-1111-4111-8111-111111111112';
update things set local_note =
  'Hit the second roaster on the block before 9am — that''s when they pull the best shots, before the crowd.'
  where id = '11111111-1111-4111-8111-111111111113';
update things set local_note =
  'Time it with low tide and walk toward the bluffs. This is the locals'' stretch — quiet even in summer.'
  where id = '11111111-1111-4111-8111-111111111115';

-- 2) submissions: public submit (lands as 'new', founder reviews later) ------
create or replace function submit_thing(
  p_kind text, p_payload jsonb, p_name text, p_email citext, p_consent boolean
) returns uuid
language plpgsql security definer set search_path = public
as $$
declare v_id uuid;
begin
  if p_kind not in ('event','business') then
    raise exception 'kind must be event or business';
  end if;
  insert into submissions (kind, status, raw_payload, submitter_name, submitter_email, consent)
  values (
    p_kind::submission_kind,
    'new',
    coalesce(p_payload, '{}'::jsonb),
    nullif(p_name, ''),
    nullif(p_email::text, '')::citext,
    coalesce(p_consent, false)
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- 3) subscribers: double opt-in signup --------------------------------------
create or replace function subscribe_email(p_email citext)
returns jsonb
language plpgsql security definer set search_path = public
as $$
declare
  v_status subscriber_status;
  v_confirm uuid;
  v_unsub uuid;
begin
  if p_email is null or position('@' in p_email::text) = 0 then
    raise exception 'invalid email';
  end if;

  select status, confirm_token, unsubscribe_token
    into v_status, v_confirm, v_unsub
    from subscribers where email = p_email;

  if not found then
    insert into subscribers (email, status, consented_at)
    values (p_email, 'pending', now())
    returning status, confirm_token, unsubscribe_token
      into v_status, v_confirm, v_unsub;
  elsif v_status = 'unsubscribed' then
    update subscribers set status = 'pending', consented_at = now()
      where email = p_email
      returning status, confirm_token, unsubscribe_token
        into v_status, v_confirm, v_unsub;
  end if;

  return jsonb_build_object(
    'status', v_status, 'confirm_token', v_confirm, 'unsubscribe_token', v_unsub
  );
end;
$$;

create or replace function confirm_subscription(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update subscribers
    set status = 'confirmed', confirmed_at = now()
    where confirm_token = p_token and status <> 'unsubscribed';
  return found;
end;
$$;

create or replace function unsubscribe(p_token uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
begin
  update subscribers set status = 'unsubscribed' where unsubscribe_token = p_token;
  return found;
end;
$$;

grant execute on function submit_thing(text, jsonb, text, citext, boolean) to anon, authenticated;
grant execute on function subscribe_email(citext) to anon, authenticated;
grant execute on function confirm_subscription(uuid) to anon, authenticated;
grant execute on function unsubscribe(uuid) to anon, authenticated;
