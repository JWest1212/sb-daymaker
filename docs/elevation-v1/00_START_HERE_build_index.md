# SB Daymaker — Elevation v1 · Build Index (START HERE)

`For Claude Code. Read this before opening any gate file.`
`Series: Elevation v1 · 6 gate specs · additive DDL only · founder applies all schema by hand.`

---

## What this build is

A six-gate elevation of SB Daymaker that turns "curated" from a claim into a system, opens the free organic-growth channel, and ships the constraint-based planner that is the product's actual moat. It is derived from an exhaustive audit of the live site (48 findings) and a founder decision session. Every decision below is **locked** — do not relitigate them; if implementation reveals a genuine conflict with a `CLAUDE.md` §2 constraint, **stop and flag** rather than working around it.

## The prime directive of this build

**Trust before growth before differentiation.** A visitor must never catch the site in a self-contradiction. Gate 0 removes existing contradictions; Gate 1 makes new ones impossible; only then do Gates 2–5 add reach and features. Do not jump ahead to the exciting gates (4, 5) before 0 and 1 are closed — a great planner built on untrustworthy data is worse than no planner.

---

## Locked decisions (the founder session)

| Area | Decision |
|---|---|
| Scope | Everything incl. growth loops (skipping only "Right Now" and live weather) |
| Inventory | Expand with quality tiers — **demote, never cull** |
| Tier surfacing | Tier 2 = compact card; Tier 3 = hidden from public feed |
| Audience | Visitors and locals weighted equally |
| Categories | No new activity categories this build |
| Recurring events | Own section, computed next-dates (no "every week" labels) |
| Local's Secret | Hide the section when there's no real secret |
| Location on detail | Address + Directions deep link (no map embed / no map API cost) |
| Corrections | One-tap flag → review queue |
| URLs | Full slugs + 301 redirects |
| Structured data | Event + LocalBusiness + Breadcrumb JSON-LD |
| Photo fallback | Motif fallback (existing system) |
| Planner | Full engine: party / anchor / meals / transport / budget |
| Plan sharing | Server permalink, no account (rides `shared_states`) |
| Weather | **No weather logic this build** (deferred) |
| Right Now | **Skipped this build** |
| Explore | Search + Weekend filter |
| Sharing | Share buttons + per-thing OG cards |
| Bottom nav | **Keep 3 tabs.** The "Build your day" CTA banner is **untouched this build** (do not move or restyle it) |
| About page | **Out of scope this build** (no `/about`; leave "How SB Daymaker works" link as-is) |
| Revenue | On hold — build clean seams only, nothing monetized |
| Guides | Untouched here (founder is reworking them in a separate project — coordinate, don't collide) |

---

## Build order (gates are mostly sequential; 2 and 3 can run in parallel)

```
Gate 0  Stop the Bleeding ......... trust-critical data fixes         [ship first, alone]
Gate 1  Trust Infrastructure ...... tiers, quality gate, detail       [everything inherits this]
Gate 2  Findability (SEO) ......... slugs, schema, metadata, OG   ┐   [parallelizable]
Gate 3  Navigation & IA .......... search, weekend, cross-links   ┘
Gate 4  The Concierge Day ........ the planner engine (the moat)      [needs Gate 1 data]
Gate 5  Loops & Polish ........... sharing, saved, a11y, seams        [needs Gate 2 OG]
```

**Work one gate at a time. Finish, verify on the dev server, report to Jim what changed / what to test, wait for go-ahead.** (This is `CLAUDE.md` §7/§8 working style — do not run multiple gates without check-ins.)

---

## Consolidated additive DDL (hand to Jim; he applies in Supabase — you do NOT run these)

> **DDL is a human act.** Jim pastes these into the Supabase SQL editor, in gate order. All are additive + idempotent. Some `alter type … add value` statements must run alone (not in a transaction block).

**Gate 1:**
```sql
alter table things add column if not exists quality_tier smallint not null default 2 check (quality_tier between 1 and 3);
alter table things add column if not exists verified_at timestamptz;
alter table things add column if not exists verified_by text;
do $$ begin create type recurrence_cadence as enum ('weekly','biweekly','monthly','monthly_nth_dow','bimonthly','seasonal','irregular'); exception when duplicate_object then null; end $$;
alter table recurring_schedules add column if not exists cadence recurrence_cadence not null default 'weekly';
alter table recurring_schedules add column if not exists nth_dow smallint check (nth_dow between 1 and 5);
alter table recurring_schedules add column if not exists next_occurrence date;
do $$ begin create type setting_kind as enum ('indoor','outdoor','both'); exception when duplicate_object then null; end $$;
alter table things add column if not exists setting setting_kind;
do $$ begin create type flag_status as enum ('new','reviewing','resolved','dismissed'); exception when duplicate_object then null; end $$;
create table if not exists content_flags (
  id uuid primary key default gen_random_uuid(),
  thing_id uuid references things(id) on delete cascade,
  guide_id uuid references guides(id) on delete cascade,
  reason text not null, detail text,
  status flag_status not null default 'new',
  created_at timestamptz not null default now(), resolved_at timestamptz,
  constraint flag_targets_one check ((thing_id is not null) <> (guide_id is not null))
);
create index if not exists content_flags_status_idx on content_flags(status);
create index if not exists content_flags_thing_idx  on content_flags(thing_id);
-- optional (if kept as separate fields):
alter table things add column if not exists hours jsonb;
alter table things add column if not exists practical_note text;
```

**Gate 2:**
```sql
alter table things add column if not exists slug text;
alter table guides add column if not exists slug text;
create unique index if not exists things_slug_uidx on things(slug) where slug is not null;
create unique index if not exists guides_slug_uidx on guides(slug) where slug is not null;
create table if not exists url_redirects (
  from_path text primary key, to_path text not null,
  created_at timestamptz not null default now()
);
```

**Gate 4:** (run this statement on its own — enum add can't be in a txn block in some editor modes)
```sql
alter type shared_state_kind add value if not exists 'shared_plan';
```

---

## THE GOLDEN RULE — zero em dashes, anywhere, ever (existential)

> **No em dash (`—`, U+2014) may ever appear anywhere on the SB Daymaker site. Not in a blurb, a title, a secret, a guide, a button, a meta tag, an email, an alt attribute, a slug, a code comment, or database content. Never. This is not a style preference; it is a hard, load-bearing site rule that ranks alongside the §2 constraints.**

This rule is enforced in the codebase at three layers so it cannot regress (build task in **Gate 0, G0.9**):

1. **Build-time gate (CI).** A lint/check step fails the build if a `—` (U+2014) appears in any source file (`.ts`, `.tsx`, `.md` rendered to the site, JSX copy, email templates). No em dash, no green build.
2. **Write-time sanitizer.** The nightly enrich/ingest pipeline strips/normalizes any `—` in AI-drafted or scraped content to an appropriate replacement (`, ` / `. ` / `: ` / ` to ` per context) **before** anything is written to `things`, `guides`, `recurring_schedules`, `editions`, etc. AI prompts also explicitly forbid em dashes in their output.
3. **Render-time guard (last line of defense).** A shared text-render helper normalizes any stray `—` to a safe replacement at display time, so even if bad data somehow exists, a user never sees an em dash.

Replacement guidance (in order of preference): recast the sentence; else use a comma, a period, a colon, parentheses, or the word "to" (for ranges: "5 to 8pm," not "5—8pm"). En dashes in numeric ranges should likewise be avoided in favor of "to." **When in doubt, there is no em dash.**

---

## Cross-gate invariants (never violate — these are `CLAUDE.md` §2 restated for this build)

1. **ZERO EM DASHES, EVER** (the Golden Rule above). Enforced at build time, write time, and render time. An em dash anywhere is a defect that fails the build.
2. **No per-request AI.** Search, planner, tiering, next-date computation — all deterministic. AI only in the nightly batch.
3. **No accounts.** Saves = localStorage; the only PII is subscriber email + magic-link address. Shared lists/plans store **no recipient PII**.
4. **No transactions, no cart.** Ticketing hands off via outbound links.
5. **The ranker never reads sponsor status.** Featured placement is labeled + structurally separate. Gate 5 proves this with a test.
6. **No `.ics`, no map tiles, no revived "Make My Day."** All retired in §9 — do not reintroduce, even as a "helpful" addition.
7. **WCAG 2.2 AA is the floor**, built into every component, not a finishing pass.
8. **Additive DDL only, applied by the human.** Never run migrations yourself; never "improve" the schema mid-build.
9. **No hardcoded colors/fonts/spacing** — tokens only. Plain `$` signs (never backslash-escaped). (Em dashes are covered by the Golden Rule, invariant 1.)
10. **Coordinate on guides.** The founder is reworking Discover SB elsewhere. Gate 2's guide-SSR and Gate 3/5's guide-linking are wiring tasks only — do not restructure guide content or layout. If the guide component is mid-rework, flag and defer.
11. **`react-hooks/exhaustive-deps` never silently disabled** (§8.9 — this caused the been-marking regression).

---

## Definition of done for the whole build

A skeptical first-time visitor and a jaded local both experience a site where: nothing contradicts itself; every entry has earned its place and could get you to the door; every page is findable and shareable as a designed artifact; the planner hands you a day that is actually executable; and the revenue seams are clean enough to switch on later without ever touching the ranker. Report gate-by-gate against each gate's acceptance summary.
