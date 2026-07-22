# Cockpit Build · Handoff README

## Files in this handoff (all generated in the Cowork improvement program, 2026-07-20)

1. cockpit_build_specs_v1.md - THE build spec. Five waves, standing rules at top, hard gates. This is what you paste/attach to Claude Code, one wave at a time.
2. cockpit_mockups_r1.html - approved: Today screen (Morning Ledger + phone) and Field Card direction, badge-equipped shell.
3. cockpit_mockups_r2.html - approved: full Queue screen, Field Card edit mode, the sheet primitive with LIVE/DRAFT zones, undo toast.
4. cockpit_mockups_r3.html - approved: Edition desk with save-all bar, Images desk with resume banner, Coverage heatmap.
5. cockpit_mockups_r4.html - approved: Live catalog, Venues (true count + pager + permanence labels), Sources, Flags, /admin/login.

## Already in the repo (do not re-attach, Claude Code reads them in place)

- docs/cockpit/ - the sixteen-file build spec of the CURRENT cockpit (index.md, 01-15, appendix-index.json). The build spec's citations (file:line, SCR/CMP/API ids, the change-safety map) resolve there. If docs/cockpit/ is missing or uncommitted in the repo, commit it first; the build depends on it.

## How to run each wave in Claude Code

Every session: start by pasting the "Standing rules for every wave" section from cockpit_build_specs_v1.md, then the wave's section.

- Wave 1 (quick wins): spec only. No mockups needed.
- Wave 2 (Today + badges): spec + cockpit_mockups_r1.html (and r2 for the shell/badge styling reference).
- Wave 3 (workflow doors): spec + r2 (Recently rejected panel, toast) + r3 (save-all bar, resume banner) + r4 (login).
- Wave 4 (consistency spine): spec + r2 (sheet primitive, LIVE/DRAFT zones, toast grammar) + r4 (vocabulary labels in context).
- Wave 5 (reskin): spec + ALL four mockup files.

## Non-negotiables to repeat if Claude Code ever drifts

- One wave per session, one gate at a time, stop and show, Jim approves in the browser.
- Change-safety map (docs/cockpit/11-change-safety.md) is behavior law; restyle only.
- No DDL executed; additive SQL written out for Jim to paste in Supabase.
- Every new API route carries its own getAdminUser() check; every new page lives behind the /admin layout gate (except the Wave 3 login route group, as specified).
- Zero em-dashes, plain dollar signs, WCAG 2.2 AA, tokens only (no new raw hex).
- The ranker never reads sponsor status; starts_at is never editable.
