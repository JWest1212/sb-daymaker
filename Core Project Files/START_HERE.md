# START HERE — SB Daymaker

`Status: v9 canon · last updated 2026-06-21 · the front door to the whole project`

> **v10 note:** the app is **four sections** — Explore · Saved · Discover SB · Plan — but the bottom nav still has **three tabs**; Plan is reached via the "Build your day" CTA, **not a nav tab**. **One Perfect SB Day / "Make My Day" was scrapped (2026-07-04).** **CLAUDE.md v10 is authoritative**; see Doc 14 (`14_SBDaymaker_Build_Deltas.md`). The "three sections" phrasing and any One-Perfect-Day mention below are stale.

You're building **SB Daymaker** — a mobile-first local-discovery app for Santa Barbara, with three sections: **Explore · Saved · Discover SB.** This file is the map to all the other files: what each one is, and the order to use them. If you're ever lost, come back here.

---

## Step 1 — Attach all of these files to the project

Put every file below in your Claude project (and, once you start coding, in your repo so Claude Code can read them). They work as a set.

**The build engine (Claude Code reads these automatically or on request):**
- `CLAUDE.md` — the rules the AI builder follows every session
- `sbdaymaker_schema.sql` — the database design (the data contract)
- `sbdaymaker_tokens.css` — the design system (colors, fonts, spacing)
- `02b_SBDaymaker_Wireframe.html` — the interactive prototype (what every screen looks like)

**The runbooks you follow:**
- `08_SBDaymaker_Build_Plan.md` *and* `08_SBDaymaker_Build_Plan.html` — the phased build plan (same content; `.md` for the AI, `.html` for you)
- `09_SBDaymaker_Seed_Data_Guide.html` — how to fill the app with content
- `SBDaymaker_Credentials_and_Env.md` — every account & API key you'll need

**The reference library (read for understanding; the build doesn't require editing them):**
- `00_SBDaymaker_Project_Context.md` — the master overview of everything
- `01_SBDaymaker_Business_Plan.html` — the "why," audience, roadmap
- `02_SBDaymaker_Product_Bible.html` — screen-by-screen detail*
- `03_SBDaymaker_Platform_Architecture.html` — how it works technically
- `04_SBDaymaker_PreBuild_Audit.html` — risks found before building*
- `05_SBDaymaker_PreBuild_Decisions.html` — every decision, settled
- `06_SBDaymaker_Critical_UX_Assessment.html` — the UX reasoning*
- `07_SBDaymaker_Innovation_Differentiation.html` — why it wins ("Your Santa Barbara")

> *Files marked with an asterisk carry a banner noting some screen-level detail predates the v9 three-section cut. For anything about how the app looks or works today, **`CLAUDE.md` and the wireframe are the authority.**

---

## Step 2 — Understand the product (about an hour, optional but smart)

Read in this order:
1. **`00_SBDaymaker_Project_Context.md`** — the whole product in one document.
2. **`07_SBDaymaker_Innovation_Differentiation.html`** — what makes it special and the order to build its standout features.
3. Skim **`02b_SBDaymaker_Wireframe.html`** — click through the prototype so you know the target.

You don't need to read the rest cover-to-cover; they're there when a specific question comes up.

---

## Step 3 — Build it

This is the part that actually makes the app. **Open `08_SBDaymaker_Build_Plan` and work through it phase by phase, in order (0 → 9).** Don't skip; each phase ends with a checklist, and the next phase assumes the previous one passed.

- **Phase 0** sets up your accounts and tools (use `SBDaymaker_Credentials_and_Env.md` alongside it).
- **Phase 1** sets up the database and loads practice content (using `09_SBDaymaker_Seed_Data_Guide.html`, Stage 1).
- **Phases 2–7** build the app screens.
- **Phase 8** builds the automation that keeps it fresh.
- **Phase 9** loads real content (Seed Guide, Stage 2) and launches.

**If you only do one thing right now:** open `08_SBDaymaker_Build_Plan.html`, read "How this works," and start Phase 0.

---

## The one-line map

> **`CLAUDE.md`** = the rules · **`08` Build Plan** = the route · **`09` Seed Guide** = the content · **Credentials file** = the keys · **schema + tokens + wireframe** = the contracts the app is built against. Everything else is reference.

Build one phase at a time. Tick every checklist box before moving on. You've got this.
