-- Images desk (cockpit Images tab, 2026-07-11) — additive only.
--
-- things.photo_ack: the founder's "this looks right on the motif/gradient,
-- stop surfacing it" dismiss flag for the Images tab's queue. Mirrors the
-- Venues no-match catcher's things.no_venue_ack (V-4) exactly: cockpit-side
-- only, nothing the public site reads.
alter table things add column if not exists photo_ack boolean not null default false;
