# Claude Code Kickoff · SB Daymaker Reader Edition / Digest

You are implementing the SB Daymaker **reader edition**: the twice-weekly email, its cockpit draft-and-approve workflow, and its public permalink, inside this repo.

## Read these first, in order
1. `CLAUDE.md` — the project contract. It governs. Live code is truth; if a doc conflicts with code, follow the code and flag the stale doc.
2. `docs/edition-build/edition_build_spec.md` — **the authoritative build spec for this work.** Everything you build conforms to it. Build in the order in its §1.
3. `docs/edition-build/edition_anatomy_and_field_map_v3.md` — the content model and field map (which email element maps to which `things` field, and the provenance of every string).
4. `docs/edition-build/edition_copy_kit_v2.md` — the voice, the subject/preheader/greeting pools, every chrome string, and the hard rules (including the em-dash ban).
5. `docs/edition-build/edition_themed_mockup_v3.html` — the visual source of truth (zoned-bands direction). Convert it to email-safe HTML per the spec. Do not redesign it.

## Ground yourself in the live code before writing anything
- **Schema: use the live snapshot, not the base file.** `sbdaymaker_schema.sql` is v9 and lags. `hero_pins` and the subscriber RPCs live in later migrations. Treat `03_data_layer.md` as the live shape, read the migrations, and design your new migrations against that.
- **Reuse, do not fork:** `explore.ts` (`cascade()`), `things.ts`, `heroServer.ts` (the never-blank, sponsor-blind hero logic and `hero_pins`), the `whenString` helper, `run.ts` (the nightly pipeline where the drafter and send hook in), `lib/email.ts` (Resend), and the existing cockpit module (where `hero_pins` lives) as the home for the new Edition Draft module.

## Hard invariants (spec §0, do not cross)
- No AI synthesis at send. No sponsor-aware ranking (enforce sponsor-blindness in the query, not just by convention). Confirmed subscribers only. No em dashes anywhere in the digest (normalize the assembled output). WCAG 2.2 AA. Renders once; overrides are applied at draft time, not per recipient. The only required human action is a one-tap approve; if unapproved by 07:00 PT, auto-send the draft.

## How to work
- Start with the data-layer migrations (spec §2). **Present the migration plan for my approval before applying anything to the database.**
- Then the drafter (§3), renderer (§6), cockpit Edition Draft module (§5), and send path (§7), in the spec's suggested order.
- **Checkpoint with me after the data layer plus a runnable drafter draft**, before building the cockpit UI.
- Respect the non-goals (§12): no personalization fill, no sponsor content, no accounts, no per-pick share tokens, no synthesis.
- Two preconditions (§13): the sending domain must be verified in Resend (owner is handling this), and you should create the `edition-media` Supabase Storage bucket (public read).
- Read all secrets from env (`RESEND_API_KEY`, `SUPABASE_*`, the Google Places key). Never hardcode.

## Your first response
Confirm you have read the spec and the live schema. List the migrations you propose (the tables and columns from §2). Outline your build sequence. Do not modify the database or send any email until I approve the migration plan.
