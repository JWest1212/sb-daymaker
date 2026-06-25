# SB Daymaker — Credentials &amp; Environment Reference

`Status: v10 canon · last updated 2026-06-24 · the one place all keys & accounts are listed`

This is your **single checklist of every account, API key, and setting** SB Daymaker needs. The Build Plan (Document 8) tells you *when* you need each one for the app itself; the Ingestion Setup (Document 12) covers the nightly engine. This file tells you *what each is called, where to get it, and whether it's safe to expose.* Keep it handy during the build — credential confusion is the #1 thing that slows a non-technical founder down.

> **What changed in v10:** added the keys for the nightly ingestion engine (Documents 10–13) — the Ticketmaster events feed and the three photo sources (Pexels, Wikimedia, Google Places). **None of these existed in the original build**; they are set up during ingestion Phases 10 and 13. The image sources in particular were never part of Document 8 — if you finished that guide and didn't set up Google Places or Pexels, that's expected.

---

## First, the confusion that trips everyone up

There are **two completely different "Claude" logins**, and they are not the same thing:

| | What it is | How you use it |
|---|---|---|
| **Claude Code sign-in** | Your normal Claude subscription, used to log into the **build tool** in VS Code. | You sign in once in the Claude Code extension. This is how Claude writes your code. **Not** an API key. |
| **Anthropic API key** (`ANTHROPIC_API_KEY`) | A secret key that lets *your app* call Claude for the nightly content enrichment. | You paste it into your app's secret settings in Phase 8. **Different account area, different purpose.** |

If you remember nothing else: **the build tool uses your subscription login; the app uses an API key.** They are separate.

---

## The golden security rule

Every key below is labeled **PUBLIC** or **SECRET**.

- **PUBLIC** keys are safe to appear in the app's browser code. (They're designed to be seen; other protections guard them.)
- **SECRET** keys must **only ever** live on the server side — in the nightly pipeline, the admin cockpit, or server routes — and **never** in code that runs in the browser.

In practice: Claude Code knows this rule, but you can sanity-check it. **If you ever see a key labeled SECRET being used in a screen/component the user can see, stop and ask Claude Code to move it server-side.** Also: **never paste a SECRET key into a normal chat, a screenshot, or a public place.** And never commit your `.env.local` file to GitHub (Claude Code will set it to be ignored automatically).

---

## The full credentials checklist — the app (Documents 1–8)

| Account / key | Env var name | Public or secret | Where to get it | Needed in |
|---|---|---|---|---|
| **GitHub** account + empty `sb-daymaker` repo | — | — | github.com | Phase 0 |
| **Claude Code** sign-in (your subscription) | — | — | The Claude Code extension in VS Code | Phase 0 |
| **Vercel** account (connected to GitHub) | — | — | vercel.com | Phase 0 |
| **Supabase** project URL | `NEXT_PUBLIC_SUPABASE_URL` | 🟢 PUBLIC | Supabase → Connect (or Project Settings → API Keys) | Phase 1 |
| **Supabase** publishable key (`sb_publishable_…`) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 🟢 PUBLIC | Supabase → Project Settings → API Keys | Phase 1 |
| **Supabase** secret key (`sb_secret_…`) | `SUPABASE_SECRET_KEY` | 🔴 SECRET | Supabase → Project Settings → API Keys | Phase 8 (pipeline + cockpit) |
| **OpenWeather** API key | `OPENWEATHER_API_KEY` | 🔴 SECRET | openweathermap.org → API keys | Phase 4 |
| **Resend** API key | `RESEND_API_KEY` | 🔴 SECRET | resend.com → API Keys | Phase 7 |
| **Anthropic** API key (the app's batch AI) | `ANTHROPIC_API_KEY` | 🔴 SECRET | console.anthropic.com → API Keys | Phase 8 |
| **Custom domain** | — | — | A registrar, or buy through Vercel | Phase 9 (app) |

> **Supabase renamed its keys in 2025–26.** New projects use a **publishable** key (`sb_publishable_…`, public/safe) and a **secret** key (`sb_secret_…`, server-only). Older projects show **anon** (= publishable) and **service_role** (= secret) on a *Legacy* tab — either set works; the legacy ones retire by end of 2026. The publishable key is safe in the browser because the database is protected by Row-Level Security; the secret key bypasses RLS (and is even blocked from running in a browser), which is why it must stay server-side. Whatever variable names Claude Code chooses, the **public vs. secret** split is what matters.

---

## The ingestion engine checklist — the nightly pipeline (Documents 10–13)

These are **new** and were not part of the original app build. They power the nightly engine that refills your review queue. They live as **GitHub Actions secrets** (for the nightly worker) and in `.env.local` (for local testing) — they are all server-side, so all SECRET.

| Account / key | Env var name | Public or secret | Where to get it | Needed in (ingestion) |
|---|---|---|---|---|
| **Ticketmaster** Discovery API (Consumer Key) | `TICKETMASTER_API_KEY` | 🔴 SECRET | developer.ticketmaster.com → My Apps → Consumer Key (free) | Phase 10 |
| **Supabase** secret key (reused) | `SUPABASE_SERVICE_ROLE` / `SUPABASE_SECRET_KEY` | 🔴 SECRET | *Same secret key as the app* — reuse it | Phase 10 |
| **Anthropic** API key (reused) | `ANTHROPIC_API_KEY` | 🔴 SECRET | *Same app key from Phase 8* — reuse it | Phase 11 (batch enrichment) |
| **Pexels** API key | `PEXELS_API_KEY` | 🔴 SECRET | pexels.com/api → sign up → API key (free, no card) | Phase 13 |
| **Wikimedia** (no key) | — | — | **No account, no key** — open API, Claude calls it directly | Phase 13 |
| **Google Places** API key (the one paid photo source) | `GOOGLE_PLACES_KEY` | 🔴 SECRET | cloud.google.com → new project → enable Places API (New) → Credentials → API key | Phase 13 |
| **Resend** API key (reused) | `RESEND_API_KEY` | 🔴 SECRET | *Same key from Phase 7* — reuse for the nightly digest email | Phase 13 |

> **Two of these you already have — reuse, don't recreate.** Your **Resend** key (set up in app Phase 7) powers the nightly summary email. Your **Anthropic** key (app Phase 8) powers the nightly blurb-writing. Don't make new ones; reuse the existing values. (This is the opposite of the photo keys, which are genuinely new.)

### ⚠️ Google Places — the only credit-card account, and how its cap works

Google Places is the single paid source in the entire project, and the only one requiring a credit card. **Document 12, Phase 13 has the full click-by-click.** The short version of what you set up:

1. A **Google Cloud account + project** (`sb-daymaker`), with a card on file (Google requires one to enable the service).
2. The **Places API (New)** enabled, and an **API key** created and **restricted to Places API only** (so a leaked key can't be used for anything else).
3. **Three independent spending caps**, all set before the engine runs nightly:
   - **App counter (primary):** the pipeline keeps its own monthly count and stops calling Google before the cap. Built by Claude in Phase 13.
   - **Google quota (backstop):** a hard requests-per-day limit set in *APIs &amp; Services → Quotas* — Google itself stops past it.
   - **Budget alert (tripwire):** a billing budget in *Billing → Budgets &amp; alerts* that emails you at 50/90/100% of your monthly photo ceiling.

> **Why three?** Budget alerts only *notify* — they don't stop spending. The app counter and the Google quota are what actually *stop* the paid calls; the alert is your early warning. Together they make a surprise bill impossible. Claude will recommend the exact daily-quota number and monthly dollar cap during Phase 13 after looking up current Google pricing (this is "audit flag B6"). Remember a chunk of paid photo calls may fall under Google's **monthly free allowance** for this API.

---

## How the keys actually get used (plain version)

For the **app**, keys go in **two places** and should match:

1. **`.env.local`** — a hidden file in your project for **local development** (building/testing on your own computer). Claude Code creates and fills this; you paste values when asked. Never uploaded to GitHub.
2. **Vercel → Project → Settings → Environment Variables** — the **live website's** copy. When you deploy, Vercel reads these. You (YOU step) paste the same values in the Vercel dashboard.

For the **nightly ingestion engine**, the keys live in a third place:

3. **GitHub → your repo → Settings → Secrets and variables → Actions** — the **nightly worker's** copy. The scheduled job reads these when it runs at 2am. Claude Code walks you through adding each one (it's a copy-paste per key). The same keys also go in `.env.local` so you can test the worker locally.

So the rhythm for any new key: (a) get it from the source above, (b) give it to Claude Code for `.env.local`, and (c) add it to **Vercel** (if the app uses it) and/or **GitHub Actions secrets** (if the nightly engine uses it). Claude Code reminds you which.

---

## Quick-reference: what to have ready before each key-using phase

**The app (Document 8):**
- **Before Phase 1:** Supabase project created; URL + **publishable** key copied.
- **Before Phase 4:** OpenWeather account; API key copied.
- **Before Phase 7:** Resend account; API key copied; a sender email to test with.
- **Before Phase 8:** Anthropic API key created (console.anthropic.com — the *app* key, not your Claude Code login); Supabase **secret** key copied; Vercel set to **Pro** (for cron).
- **Before Phase 9 (app):** a domain name chosen.

**The nightly engine (Document 12):**
- **Before Phase 10:** free **Ticketmaster** Consumer Key copied (developer.ticketmaster.com). Supabase secret key on hand (reused).
- **Before Phase 11:** **Anthropic** key on hand (reused from app Phase 8).
- **Before Phase 13:** free **Pexels** key copied; **Google Cloud** account + project + **Places API (New)** enabled + restricted **API key** copied + **all three caps set**; **Resend** key on hand (reused from app Phase 7). Wikimedia needs nothing.

*Keep this file next to the Build Plan and the Ingestion Setup. When Claude Code asks for a key, this tells you which one, where it lives, whether it's safe to expose, and whether you already have it.*
