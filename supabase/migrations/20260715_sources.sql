-- Data Arch Redesign 23 — Phase 1: sources table (additive only)
-- Jim applies this by hand in Supabase SQL Editor. Safe to re-run (all guards).
-- No changes to source_runs / ingest_drops — they already exist and are reused as-is.

create table if not exists sources (
  id                 uuid primary key default gen_random_uuid(),
  key                text not null unique,              -- matches source_runs.source / adapter.key exactly
  label              text not null,
  url                text,
  lane               text not null default 'structured',       -- 'structured' | 'generic' | 'render' (future use)
  parse_method       text,                                -- 'api' | 'ics' | 'jsonld' | 'html' | 'form' | 'db'
  authority          numeric(3,2) not null default 0.70,  -- 0-1, seeded from the old dedupe rank order
  category_hints     text[] not null default '{}',
  neighborhood_hint  neighborhood,
  crawl_frequency    text not null default 'nightly',      -- 'nightly' | 'weekly' | 'reserve'
  expected_yield     integer not null default 0,
  last_ok_at         timestamptz,
  last_yield         integer,
  consecutive_empty  integer not null default 0,
  reliability        numeric(3,2) not null default 1.00,
  maintenance_burden smallint not null default 1,
  status             text not null default 'active',       -- 'active' | 'paused' | 'retired' | 'candidate'
  notes              text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
alter table sources enable row level security;   -- service-role / cockpit only, no public policy
create index if not exists sources_key_idx on sources(key);

-- ---------------------------------------------------------------------------
-- Seed: one row per adapter, authority derived from the old SOURCE_RANK order
-- in ingest/dedupe.ts. All 31 adapters + the 2 pipeline-internal sources
-- (registry, submission) start status='active' (matches today — nothing is
-- currently disabled), crawl_frequency='nightly' (matches today's real
-- behavior — no per-source scheduling exists yet; varying this now would be
-- a behavior change, not just data-modeling, so it's deferred).
-- ---------------------------------------------------------------------------

insert into sources (key, label, lane, parse_method, authority, crawl_frequency, status, notes) values
  ('ticketmaster',     'Ticketmaster API',              'structured', 'api',    0.90, 'nightly', 'active', null),
  ('soho',              'SOhO ticketing',                'structured', 'html',   1.00, 'nightly', 'active', null),
  ('sbbowl',            'Santa Barbara Bowl',            'structured', 'html',   0.99, 'nightly', 'active', null),
  ('lobero',            'Lobero Theatre',                'structured', 'html',   0.98, 'nightly', 'active', null),
  ('granada',           'The Granada Theatre',           'structured', 'html',   0.97, 'nightly', 'active', null),
  ('arlington',         'Arlington Theatre',             'structured', 'html',   0.96, 'nightly', 'active', null),
  ('musicacademy',      'Music Academy of the West',     'structured', 'html',   0.95, 'nightly', 'active', null),
  ('alcazar',           'The Alcazar Theater',           'structured', 'html',   0.94, 'nightly', 'active', null),
  ('centerstage',       'Center Stage Theater',          'structured', 'html',   0.93, 'nightly', 'active', null),
  ('carpinteriaArts',   'Carpinteria Arts Center',       'structured', 'ics',    0.92, 'nightly', 'active', null),
  ('newVic',            'New Vic Theatre (ETC)',         'structured', 'html',   0.92, 'nightly', 'active', null),
  ('nightlifeRhythms',  'Nightlife Rhythms',             'structured', 'html',   0.91, 'nightly', 'active', 'Bundles several venues (Fig Mtn Brew, Dargan''s, etc.) under one score, per your decision — flag if this ever needs splitting.'),
  ('outdoorsOperators', 'Outdoor Operators',             'structured', 'html',   0.91, 'nightly', 'active', 'Bundles several operators (Condor Express, Ice in Paradise, etc.) under one score, per your decision — flag if this ever needs splitting.'),
  ('natureProgramsFree','Nature Programs (Free)',        'structured', 'html',   0.91, 'nightly', 'active', null),
  ('moxi',              'MOXI Museum',                   'structured', 'html',   0.85, 'nightly', 'active', null),
  ('naturalHistory',    'SB Museum of Natural History',  'structured', 'html',   0.84, 'nightly', 'active', null),
  ('botanicGarden',     'SB Botanic Garden',             'structured', 'html',   0.83, 'nightly', 'active', null),
  ('sbma',              'SB Museum of Art',              'structured', 'html',   0.82, 'nightly', 'active', null),
  ('ucsb',              'UCSB Campus Events',            'structured', 'api',    0.80, 'nightly', 'active', null),
  ('libraries',         'Santa Barbara Public Library',  'structured', 'ics',    0.79, 'nightly', 'active', null),
  ('registry',          'Recurring registry',            'structured', 'db',     0.90, 'nightly', 'active', 'Founder-curated (you personally vet every entry via the cockpit). Legacy dedupe table had no entry for this one (defaulted to lowest priority) — seeded high-trust instead since it''s hand-reviewed. Flagging for your check.'),
  ('independent',       'The Independent',               'structured', 'html',   0.70, 'nightly', 'active', null),
  ('citysb',            'City of Santa Barbara',         'structured', 'html',   0.69, 'nightly', 'active', null),
  ('goletaCivic',       'City of Goleta',                'structured', 'html',   0.68, 'nightly', 'active', null),
  ('carpinteriaCivic',  'City of Carpinteria',           'structured', 'html',   0.67, 'nightly', 'active', null),
  ('downtownSB',        'Downtown Santa Barbara',        'structured', 'html',   0.66, 'nightly', 'active', null),
  ('farmersMarkets',    'SB Certified Farmers Markets',  'structured', 'html',   0.65, 'nightly', 'active', 'Legacy dedupe table had no entry for this one (defaulted to lowest priority) — seeded at civic-tier instead since it''s a direct, non-aggregator source. Flagging for your check.'),
  ('coastalView',       'Coastal View',                  'structured', 'html',   0.64, 'nightly', 'active', null),
  ('sbcountyArts',      'SB County Arts Commission',     'structured', 'html',   0.63, 'nightly', 'active', null),
  ('eventbrite',        'Eventbrite (SB)',               'structured', 'jsonld', 0.40, 'nightly', 'active', null),
  ('allevents',         'AllEvents (SB)',                'structured', 'html',   0.39, 'nightly', 'active', null),
  ('seatgeek',          'SeatGeek (SB)',                 'structured', 'api',    0.38, 'nightly', 'active', null),
  ('submission',        'Public submissions',            'structured', 'form',   0.30, 'nightly', 'active', 'Public, unvetted user input — seeded at the bottom deliberately; these already go through your review queue before anything publishes.')
on conflict (key) do nothing;
