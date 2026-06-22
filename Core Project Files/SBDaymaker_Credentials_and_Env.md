# SB Daymaker — Credentials &amp; Environment Reference

`Status: v9 canon · last updated 2026-06-21 · the one place all keys & accounts are listed`

This is your **single checklist of every account, API key, and setting** SB Daymaker needs. The Build Plan (Document 8) tells you *when* you need each one; this file tells you *what it's called, where to get it, and whether it's safe to expose.* Keep it handy during the build — credential confusion is the #1 thing that slows a non-technical founder down.

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

## The full credentials checklist

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
| **Custom domain** | — | — | A registrar, or buy through Vercel | Phase 9 |

> **Supabase renamed its keys in 2025–26.** New projects use a **publishable** key (`sb_publishable_…`, public/safe) and a **secret** key (`sb_secret_…`, server-only). Older projects show **anon** (= publishable) and **service_role** (= secret) on a *Legacy* tab — either set works; the legacy ones retire by end of 2026. The publishable key is safe in the browser because the database is protected by Row-Level Security; the secret key bypasses RLS (and is even blocked from running in a browser), which is why it must stay server-side. Whatever variable names Claude Code chooses, the **public vs. secret** split is what matters.

---

## How the keys actually get used (plain version)

You'll put these keys in **two places**, and they should match:

1. **`.env.local`** — a hidden file in your project for **local development** (when you're building/testing on your own computer). Claude Code creates and fills this for you; you just paste the values when asked. This file is never uploaded to GitHub.
2. **Vercel → Project → Settings → Environment Variables** — the **live website's** copy of the same keys. When you deploy, Vercel reads these. You (YOU step) paste the same values here in the Vercel dashboard.

So the rhythm is: when a phase needs a new key, you (a) get it from the source above, (b) give it to Claude Code to put in `.env.local`, and (c) add it to Vercel's Environment Variables for production. Claude Code will remind you, but now you know the whole picture.

---

## Quick-reference: what to have ready before each key-using phase

- **Before Phase 1:** Supabase project created; URL + **publishable** key copied (Project Settings → API Keys).
- **Before Phase 4:** OpenWeather account; API key copied.
- **Before Phase 7:** Resend account; API key copied; a sender email to test with.
- **Before Phase 8:** Anthropic API key created (console.anthropic.com — this is the app key, *not* your Claude Code login); Supabase **secret** key copied; Vercel set to **Pro** (for cron).
- **Before Phase 9:** a domain name chosen.

*Keep this file next to the Build Plan. When Claude Code asks for a key, this tells you which one, where it lives, and whether it's safe to expose.*
