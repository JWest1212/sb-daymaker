-- Living Postcard Phase 1 — guides content model (spec §2).
-- Additive only: 5 columns on guides, 3 on guide_stops. New columns ride the
-- existing RLS row policies (no new policies). `content` is never queried into,
-- so it gets no index. Idempotent throughout — safe to re-run.
-- ▶ JIM RUNS THIS. Do not run DDL from code.

alter table guides
  add column if not exists stamp_code   text,
  add column if not exists refreshed_on date,
  add column if not exists now_note     text,
  add column if not exists now_note_on  date,
  add column if not exists content      jsonb not null default '{}'::jsonb;

do $$ begin
  alter table guides add constraint guides_stamp_code_ck
    check (stamp_code is null or stamp_code ~ '^[A-Z]{2}$');
exception when duplicate_object then null; end $$;

create unique index if not exists guides_stamp_code_uq
  on guides (stamp_code) where stamp_code is not null;

alter table guide_stops
  add column if not exists chapter    smallint not null default 1,
  add column if not exists sub        text,
  add column if not exists maps_query text;

do $$ begin
  alter table guide_stops add constraint guide_stops_chapter_ck
    check (chapter >= 1);
exception when duplicate_object then null; end $$;
