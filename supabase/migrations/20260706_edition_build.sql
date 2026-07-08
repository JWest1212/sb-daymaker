-- Reader Edition / Digest — additive + one corrective schema change (approved 2026-07-06).
-- Governing spec: docs/edition-build/edition_build_spec.md §2. Extends the existing
-- editions/edition_picks (base contract, currently 0 rows in both — safe to alter
-- directly). Idempotent throughout so this file can be re-run safely.

-- ============================================================================
-- 1) editions — dedicated lifecycle enum (corrective) + edition_type + fields
-- ============================================================================
-- editions.status was typed `thing_status` (draft|needs_review|published|archived) —
-- the CONTENT lifecycle, wrong domain for an edition (there's no "published" or
-- "needs_review" edition, and the send lifecycle needs "sent", which thing_status
-- doesn't have). editions has 0 rows live, so this is a safe direct type swap
-- rather than an extension of the shared enum.
do $$ begin
  create type edition_status as enum ('draft','approved','sent','skipped','failed');
exception when duplicate_object then null; end $$;

do $$ begin
  create type edition_type as enum ('weekend','week_ahead');
exception when duplicate_object then null; end $$;

-- Both public_read_editions (directly) and public_read_editionpicks (via a
-- subquery on e.status) depend on editions.status — Postgres blocks an ALTER
-- COLUMN TYPE while either exists, so drop them first and recreate after.
drop policy if exists public_read_editions on editions;
drop policy if exists public_read_editionpicks on edition_picks;

do $$ begin
  if not exists (
    select 1 from pg_type t
    join pg_attribute a on a.atttypid = t.oid
    join pg_class c on c.oid = a.attrelid
    where c.relname = 'editions' and a.attname = 'status' and t.typname = 'edition_status'
  ) then
    alter table editions alter column status drop default;
    alter table editions alter column status type edition_status using status::text::edition_status;
    alter table editions alter column status set default 'draft';
  end if;
end $$;

alter table editions add column if not exists edition_type edition_type;
alter table editions add column if not exists subject text;
alter table editions add column if not exists preheader text;
alter table editions add column if not exists greeting text;
alter table editions add column if not exists scheduled_send_at timestamptz;
alter table editions add column if not exists sent_at timestamptz;
alter table editions add column if not exists resend_broadcast_id text;
alter table editions add column if not exists sent_count int not null default 0;
alter table editions add column if not exists open_count int not null default 0;
alter table editions add column if not exists click_count int not null default 0;
alter table editions add column if not exists skip_reason text;
-- (approved_at already exists on the base contract; edition_date is already the
-- unique permalink slug for /edition/{edition_date}.)

-- Public reads a SENT edition (not "published" — that concept doesn't apply here).
-- (policy was dropped above, ahead of the column-type change)
create policy public_read_editions on editions
  for select using (status = 'sent');

-- ============================================================================
-- 2) edition_picks — extend slot enum, add overrides, switch to a surrogate PK
-- ============================================================================
alter type edition_slot add value if not exists 'nonevent';
alter type edition_slot add value if not exists 'anchor';

alter table edition_picks add column if not exists override_title text;
alter table edition_picks add column if not exists override_blurb text;
alter table edition_picks add column if not exists override_when text;
alter table edition_picks add column if not exists override_neighborhood text;
alter table edition_picks add column if not exists override_local_note text;
alter table edition_picks add column if not exists override_image_url text;
alter table edition_picks add column if not exists cached_image_url text;
alter table edition_picks add column if not exists is_manual boolean not null default false;

-- Surrogate id so the cockpit swap/override UI and the image pipeline address a
-- stable row per pick, instead of juggling the composite (edition_id, thing_id)
-- key across a swap. The composite becomes a plain uniqueness guarantee (a thing
-- still can't appear twice in one edition).
alter table edition_picks add column if not exists id uuid default gen_random_uuid();
update edition_picks set id = gen_random_uuid() where id is null;
alter table edition_picks alter column id set not null;

do $$ begin
  if exists (select 1 from pg_constraint where conname = 'edition_picks_pkey') then
    alter table edition_picks drop constraint edition_picks_pkey;
  end if;
end $$;
alter table edition_picks add constraint edition_picks_pkey primary key (id);
do $$ begin
  alter table edition_picks add constraint edition_picks_edition_thing_uniq unique (edition_id, thing_id);
exception when duplicate_object then null; end $$;
-- edition_one_hero (exactly one hero per edition) is a partial index on
-- (edition_id) and is untouched by the PK change above.

-- (policy was dropped above, ahead of the column-type change)
create policy public_read_editionpicks on edition_picks
  for select using (exists (select 1 from editions e where e.id = edition_id and e.status = 'sent'));

-- ============================================================================
-- 3) edition_candidates — new: the ranked bench per slot (cockpit swap control)
-- ============================================================================
create table if not exists edition_candidates (
  id          uuid primary key default gen_random_uuid(),
  edition_id  uuid not null references editions(id) on delete cascade,
  slot        edition_slot not null,
  thing_id    uuid not null references things(id),
  rank        int not null,              -- 0 = best
  selected    boolean not null default false,
  unique (edition_id, slot, thing_id)
);
create index if not exists edition_candidates_edition_idx on edition_candidates(edition_id, slot, rank);

-- Cockpit-only bench, never rendered publicly — no public read policy.
alter table edition_candidates enable row level security;

-- ============================================================================
-- 4) subscribers — suppression states (bounces / spam complaints)
-- ============================================================================
alter type subscriber_status add value if not exists 'bounced';
alter type subscriber_status add value if not exists 'complained';

-- ============================================================================
-- 5) Storage — edition-media bucket (public read; writes stay service-role only)
-- ============================================================================
insert into storage.buckets (id, name, public)
values ('edition-media', 'edition-media', true)
on conflict (id) do nothing;
