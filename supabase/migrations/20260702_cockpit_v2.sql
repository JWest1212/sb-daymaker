-- Cockpit v2 — additive schema (approved at C0, 2026-07-02).
-- New tables only; touches no existing column or enum. Idempotent guards throughout.
-- Consumed by: restock (C2), hero plan (C4), live-catalog edit overlay (C3).

-- 1) Restock directives: founder intent the nightly worker consumes.
do $$ begin
  create type restock_scope  as enum ('vibe','zone');
exception when duplicate_object then null; end $$;
do $$ begin
  create type restock_status as enum ('queued','running','done','failed');
exception when duplicate_object then null; end $$;

create table if not exists restock_directives (
  id            uuid primary key default gen_random_uuid(),
  scope_kind    restock_scope not null,
  scope_key     text not null,            -- occasion_tag value or nearby_zone value (app-validated against the enum)
  window_days   smallint not null default 30 check (window_days in (7,14,30,45)),
  status        restock_status not null default 'queued',
  requested_at  timestamptz not null default now(),
  started_at    timestamptz,
  finished_at   timestamptz,
  results_count int,                      -- rows that survived the gate and landed needs_review
  run_note      text                      -- worker diagnostics ('3 landed, 12 dropped: 9 dup, 3 no_start')
);
create index if not exists restock_status_idx on restock_directives(status, requested_at desc);

-- 2) Hero pins: founder intent the nightly edition-drafter consults.
--    NOT a parallel hero system — editions/edition_picks remain the "one approved
--    day" artifact; a pin just pre-decides the hero slot for that date.
create table if not exists hero_pins (
  pin_date    date primary key,
  thing_id    uuid not null references things(id) on delete cascade,
  created_at  timestamptz not null default now()
);

-- 3) Pending edits of LIVE things: an overlay, so the published row is never
--    destabilized while an edit awaits review.
create table if not exists thing_edits (
  id          uuid primary key default gen_random_uuid(),
  thing_id    uuid not null references things(id) on delete cascade,
  payload     jsonb not null,             -- only the changed fields (title/blurb/blurb_long/tags/photo_*/price_band/time fields)
  status      text not null default 'pending' check (status in ('pending','applied','discarded')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create unique index if not exists thing_edits_one_pending on thing_edits(thing_id) where status = 'pending';
