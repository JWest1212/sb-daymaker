# SB Daymaker — Build Plan (click-by-click)

`Status: v9 canon · last updated 2026-06-21 · the phased, no-experience-assumed runbook`

This is the **map** for building SB Daymaker. It assumes **you have never set up a website, a database, or a coding tool before.** You will not write code — **Claude Code writes the code; you click, paste, and check.** Work through the phases **in order**. Each phase ends with a checklist that tells you *exactly where to click to confirm it worked.* Do not start a new phase until every box is ticked.

---

## Before you spend a dollar — three things to know

1. **Claude Code needs a PAID Claude plan.** The free Claude.ai plan does **not** include Claude Code. You'll need at least **Claude Pro (about $17–20/month)**. (Heavy building days can hit usage limits on Pro; if that happens often, the Max plan raises them. Start with Pro.)
2. **There are two different "Claude" logins, and they are not the same.** (a) Your **Claude subscription**, which powers the *build tool* (Claude Code). (b) An **Anthropic API key**, which powers *your app's* nightly content writing — you only set this up in Phase 8. If that's confusing now, ignore it; the Credentials file explains it and each phase tells you which you need.
3. **Total monthly running cost after launch is roughly $45**, plus your Claude plan. Most accounts below have free tiers you start on; you only pay as you grow.

---

## How to read this guide

- **🤖 CLAUDE BUILDS** steps: you paste a short instruction to Claude Code and let it work. You don't type code.
- **🧑 YOU DO** steps: things only you can do — create an account, copy a key, click a button in a website. Click-by-click.
- **✅ Check it worked**: after each phase, a checklist that names *exactly where to look* and *what a good result looks like*.
- **A note on screenshots that don't match:** websites change their buttons often. If a screen doesn't look exactly like what's written here, **don't panic — ask Claude Code**: type something like *"I'm on the Supabase website trying to find my project's API keys — walk me through where to click."* It can guide you to the current spot.

---

## How every build step works (read this once — it's the rhythm of the whole build)

From Phase 1 onward, every phase follows the **same five-move loop**. Here's exactly what each move looks like so you never wonder "what do I actually do?":

1. **Open your project in VS Code.** Open the VS Code app. The first time, you'll point it at your project folder (File menu → *Open Folder* → choose your `sb-daymaker` folder). After that it remembers.
2. **Open Claude Code.** In VS Code, find the **Claude** icon in the left-hand vertical bar (or open the Claude Code panel). A chat box appears — this is where you talk to your builder.
3. **Paste the phase's kickoff prompt** into that chat box and press Enter. Claude Code will think, then show you a **plan** (a numbered list of what it intends to do). **Read it.** If it mentions building anything this guide says was removed — a *Map screen* or a *My Plan* feature — type *"that's removed in v9, please re-read CLAUDE.md and revise the plan."* Otherwise, approve it (it will tell you how — usually you type *"yes, go ahead"* or click an Approve button).
4. **Let it build, and answer its questions.** It may pause to ask you to paste a key or confirm a choice. Do that, then it continues.
5. **Run the app and look at it.** To see the app on your own computer, Claude Code will start a "development server." It will show a web address that looks like **`http://localhost:3000`**. Hold Ctrl (or Cmd on Mac) and click that link, or type it into your web browser. The app opens. *That's how you "look at" the app in every checklist below.* To stop it later, click in the terminal area and press **Ctrl + C**.

> **Two safety nets, always available:** (a) **Plan mode** — making Claude show the plan before it touches anything (move 3). (b) **Rewind/checkpoint** — if a change breaks the app, ask Claude Code to *"undo the last change"* or use its rewind feature to go back to when it worked. You can't truly break anything permanently.

---

## The two tracks at a glance

- **🤖 Claude builds** the app — all the code.
- **🧑 You do** the accounts, keys, clicks, and checks. Every "YOU" step is spelled out.

---

# Phase 0 — Set up your tools and accounts (all YOU, click-by-click)

**Goal:** every account and program exists, you're signed in, and a blank "coming soon" page is live on the internet. This phase is the most clicking; it gets much smoother after this.

### 0.1 — Create a GitHub account (where your code is stored)
1. In your web browser, go to **github.com**.
2. Click **Sign up**. Enter an email, a password, and a username. Follow the prompts to verify your email.
3. Once logged in, click the **+** icon (top-right corner) → **New repository**.
4. For **Repository name**, type `sb-daymaker`. Leave everything else as-is. Click the green **Create repository** button.
5. Leave this browser tab open; you won't need to do anything else here — Claude Code connects to it later.

**✅ Check:** you can see a page titled `sb-daymaker` with your username above it.

### 0.2 — Install Node.js (the engine that runs your app on your computer)
1. Go to **nodejs.org**.
2. Click the big download button labeled **LTS** (Long-Term Support — the stable version). It auto-detects Mac or Windows.
3. Open the downloaded file and click through the installer: **Continue / Next → Agree → Install → Finish.** Accept all defaults.

**✅ Check:** you don't need to verify this yourself — Claude Code will confirm it in step 0.7. (If you're curious: it's installed if the installer said "Installation successful.")

### 0.3 — Install VS Code (the program where you'll see your project and talk to Claude Code)
1. Go to **code.visualstudio.com**.
2. Click the download button for your computer (Mac or Windows). Open the downloaded file and install it (drag to Applications on Mac; Next/Next/Finish on Windows).
3. Open **VS Code**. You'll see a welcome screen. That's fine — leave it open.

**✅ Check:** the VS Code app opens and shows a "Welcome" tab.

### 0.4 — Install Claude Code and sign in (your AI builder)
> Requires a **paid** Claude plan (see "Before you spend a dollar" above). If you don't have one, go to **claude.com**, and upgrade to **Pro** first.
1. In VS Code, look at the **far-left vertical strip of icons**. Click the one that looks like four squares (**Extensions**). A search box appears at the top of the panel.
2. Type **`Claude Code`**. In the results, find the one **published by Anthropic** and click **Install**.
3. After it installs, a **Claude** icon appears in that same left strip. Click it. A panel opens with a **Sign in** button.
4. Click **Sign in**. Your web browser opens and asks you to log in to your Claude account and approve access. Do that, then return to VS Code.

**✅ Check it worked:**
- [ ] A Claude chat panel is visible inside VS Code.
- [ ] It shows you as **signed in** (not a "Sign in" button anymore).
- [ ] If anything's off, type in the Claude panel: *"Are you set up correctly? Run a diagnostic."* — it can check itself.

*(Alternative if the extension gives you trouble: there's a graphical **Claude Desktop app** at claude.com/download, and a one-line terminal installer on the official setup page. The extension is the simplest for most people.)*

### 0.5 — Create your Supabase account and project (your database)
1. Go to **supabase.com** and click **Start your project** / **Sign up**. The easiest is **Continue with GitHub** (uses the account you just made).
2. Once in the dashboard, click **New project**.
3. Give it a name (`sb-daymaker`), and **create a database password** when asked — **write this password down somewhere safe.** Pick the region closest to California. Click **Create new project**.
4. Wait 1–2 minutes while it sets up (you'll see a progress spinner). Leave the tab open.

**✅ Check:** you land on a project dashboard with a left-hand menu (Table Editor, SQL Editor, etc.).

### 0.6 — Create your Vercel account (where your app lives on the internet)
1. Go to **vercel.com** and click **Sign Up**. Choose **Continue with GitHub** and approve the connection.
2. That's all for now — Claude Code will use this to put your app online in the next step.

**✅ Check:** you can see the Vercel dashboard (it may say "Let's build something new" or show an import screen).

### 0.7 — 🤖 First build: scaffold the app and put it online
Now hand the wheel to Claude Code. Open the Claude panel in VS Code (step 0.2 of the rhythm) and paste this:

> **🤖 Kickoff prompt:**
> Read CLAUDE.md and Phase 0 of the Build Plan. Check that Node.js is installed correctly. Then scaffold a Next.js (App Router) project for SB Daymaker in this folder, wire in sbdaymaker_tokens.css as the design tokens, and create one placeholder home page that says "SB Daymaker — coming soon" styled with those tokens. Then walk me, click by click, through connecting this folder to my GitHub repo and deploying it live to Vercel. Use Plan mode and show me the plan first. Assume I'm non-technical and explain each thing you ask me to do.

**✅ Check it worked — Phase 0 is done when:**
- [ ] In VS Code, you can see a list of project files appear in the left panel (folders like `app`, files like `package.json`). That means the app was created.
- [ ] You opened **`http://localhost:3000`** in your browser (see the rhythm, move 5) and saw a **"SB Daymaker — coming soon"** page in warm cream/terracotta colors with a serif headline — **not** plain black text on white.
- [ ] Your GitHub `sb-daymaker` page now shows code files (refresh the tab).
- [ ] **You opened the Vercel link Claude gave you (ends in `.vercel.app`) on your phone and saw the same "coming soon" page.** 🎉 Your app is on the internet.

---

# Phase 1 — Database and practice content

**Goal:** the database structure is created inside Supabase, the app can read from it, and ~25 pieces of practice content exist so later screens have something to show.

**🧑 YOU — get your Supabase connection details ready (you'll paste them when Claude asks):**
1. In your Supabase project, click **Connect** (top of the screen) — *or* the gear-shaped **Project Settings** (bottom-left) → **API Keys**.
2. You need two values. **Copy each by clicking the copy icon next to it:**
   - The **Project URL** (looks like `https://abcd1234.supabase.co`).
   - The **Publishable key** (starts with `sb_publishable_…`). *(If your project is older and only shows a "Legacy" tab with an "anon" key, that anon key works too — copy that.)*
3. Keep these handy. You'll also create the database password you saved in 0.5 if asked.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md and Phase 1. Load sbdaymaker_schema.sql into my Supabase database (walk me through running it in Supabase's SQL Editor if you can't do it directly), connect this Next.js app to Supabase using the Project URL and publishable key I'll paste, and make a simple test page that lists rows from the `things` table so we can confirm the connection works. Plan mode first. Explain anything you need me to click.

**Then load practice content:** open **`09_SBDaymaker_Seed_Data_Guide.html`** and follow **Stage 1** (it walks you through generating ~25 fixture rows with Claude and loading them). Don't do real content yet.

**✅ Check it worked — Phase 1 is done when:**
- [ ] **See your tables:** in Supabase, click **Table Editor** in the left menu. You should see tables named `things`, `guides`, `shared_states`, and more. (If they're there, the structure loaded correctly.)
- [ ] **See your rows:** click the **`things`** table. You should see roughly **25 rows** of content filling the grid.
- [ ] **See it in the app:** open the test page Claude made (it'll give you the address) and confirm it lists those items — this proves the app is reading the database.
- [ ] The Seed Guide's own Stage-1 checklist all passed.

---

# Phase 2 — The design system (the reusable building blocks)

**Goal:** the standard visual parts (buttons, cards, tags, pop-up sheets, loading placeholders) exist once, so every screen later looks consistent.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md, sbdaymaker_tokens.css, and Phase 2. Build the core reusable UI components from the tokens — buttons, a content card, chips/tags, a bottom pop-up sheet, grey "skeleton" loading placeholders, and empty-state blocks. Put them all on one hidden preview page at "/kitchen-sink" so I can see them together. Match the wireframe's look. Plan mode first.

**✅ Check it worked — Phase 2 is done when:**
- [ ] Open the address Claude gives you ending in **`/kitchen-sink`** in your browser. You see all the pieces on one page.
- [ ] Buttons and cards look **warm and rounded** with the brand fonts — not like a plain grey web form.
- [ ] Where things load, you see **soft grey placeholder shapes** (called "skeletons"), not a spinning circle.
- [ ] Tapping/clicking a card gives a small, pleasing press animation.

---

# Phase 3 — The app frame and the three tabs

**Goal:** the three-section shell exists and you can move between the sections. Still empty inside — just the frame.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md, the wireframe (02b_SBDaymaker_Wireframe.html), and Phase 3. Build the app shell with a bottom navigation bar of exactly three tabs — Explore, Saved, Discover SB — and the ability to switch between them. Each section is an empty placeholder for now, each showing its warm in-voice empty-state message. Plan mode first.

**✅ Check it worked — Phase 3 is done when:**
- [ ] Open the app in your browser. At the **bottom** you see a bar with **exactly three** buttons: **Explore · Saved · Discover SB**.
- [ ] ⚠️ If you see a **Map** tab or a **My Plan** tab, something's wrong — tell Claude *"those are removed in v9, re-read CLAUDE.md and fix the navigation."*
- [ ] Tapping each of the three tabs switches the screen.
- [ ] Each empty screen shows a friendly sentence, not a blank white page.
- [ ] **To check it looks right on a phone:** either open the page on your actual phone (using your Vercel link), or in your computer browser make the window very narrow — it should still look tidy.

---

# Phase 4 — Explore (the main daily screen)

**Goal:** the heart of the app — the time-of-day hero image, the scrolling feed of things to do, the tag filters, the Near Me sort, the save button, and the "One Perfect SB Day" card.

**🧑 YOU — get an OpenWeather key ready:**
1. Go to **openweathermap.org**, create a free account, and confirm your email.
2. Click your name (top-right) → **My API keys**. Copy the key shown (a long string of letters/numbers). Paste it to Claude Code when it asks (it's for the weather-aware hero).

> **🤖 Kickoff prompt:**
> Read CLAUDE.md, the wireframe, and Phase 4. Build the Explore screen: the golden-hour hero (reflects time of day + weather), the happenings-first cascade feed using the fixture data, the occasion-tag filter, the Near Me in-view sort (ask for the phone's location; if denied, show a neighborhood picker instead — no map), the save button with the "want to go"/"been" two states, and the One Perfect SB Day card that fills the saved list. Plan mode first.

**✅ Check it worked — Phase 4 is done when (open the app and use the Explore tab):**
- [ ] A large **hero** area sits at the top and reflects the time of day / weather.
- [ ] Below it, a **feed of cards** shows different things to do.
- [ ] **Tapping a tag** (like "Date Night") filters the feed to matching items.
- [ ] Tapping **Near Me** re-orders the list; if your browser asks "allow location?", try both allowing and denying — when denied, a **neighborhood picker** appears (and **no map** shows up).
- [ ] Tapping the **heart/save** on a card saves it; you can switch it between "want to go" and "been."
- [ ] The **One Perfect SB Day** card adds several items to your saved list at once.

---

# Phase 5 — Saved and sharing

**Goal:** the personal layer — your saved list with the two states, the Near Me sort, the share-a-list link, and the "email me my saves" backup.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md, the wireframe, and Phase 5. Build the Saved screen: the saved list grouped sensibly, the "want to go"/"been" toggle with a separate "Been" view, the Near Me sort, the share flow (let me pick one or several items, then create a view-only link via the phone's share sheet, saved to shared_states as a shared_list), and the magic-link save-restore ("email me a link to restore my saves"). No accounts/logins. Plan mode first.

**✅ Check it worked — Phase 5 is done when (open the Saved tab):**
- [ ] Items you saved earlier appear here, grouped; the empty version shows a friendly message.
- [ ] You can flip an item between **want to go** and **been**, and view a **"Been"** list.
- [ ] **Sharing test:** select an item or two and tap **Share**. Your device's share menu opens and you get a link.
- [ ] **Open that link on a different device** (or a private/incognito browser window). It shows the list, and lets you **save your own copy without logging in.**
- [ ] Tap **"email me a link to restore my saves,"** check your inbox, open the email's link, and confirm your saves come back.

---

# Phase 6 — Discover SB (the guides)

**Goal:** the third tab — neighborhood guides and theme guides, where opening a guide shows the live things happening within it.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md, the wireframe, and Phase 6. Build Discover SB: two groups of guides — neighborhood guides (scoped by zone) and theme guides (matched by occasion tag) — and a guide page that shows the guide's writing plus the live happenings scoped to it (neighborhood guides match `things` by nearby_zone; theme guides match by tag). Items inside are savable. Plan mode first.

**✅ Check it worked — Phase 6 is done when (open the Discover SB tab):**
- [ ] You see **two groups** of guides: one for neighborhoods, one for themes.
- [ ] Open a **neighborhood** guide — it shows things from that area.
- [ ] Open a **theme** guide — it shows things matching that theme.
- [ ] You can **save** an item from inside a guide, like anywhere else.

---

# Phase 7 — Detail pages, submissions, and email signup

**Goal:** the supporting pieces — the full info page for a thing, a "submit a place/event" form, and the email newsletter signup.

**🧑 YOU — get a Resend key ready (for sending email):**
1. Go to **resend.com**, sign up, and confirm your email.
2. In the dashboard, click **API Keys** → **Create API Key**. Copy the key (starts with `re_`). Paste it to Claude Code when asked.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md, the wireframe, and Phase 7. Build the detail page for a thing (full info, the local's-secret note, a save button, and a "get tickets" hand-off link to an external site), the submit-a-thing form (saves to the submissions table), and the email digest signup (saves to subscribers and sends a confirmation via Resend). Plan mode first.

**✅ Check it worked — Phase 7 is done when:**
- [ ] **Tap any card** in the feed — a full detail page opens with all its info.
- [ ] The **"Get tickets"** button opens an outside website (the app itself never takes payment).
- [ ] **Submit test:** fill in the submit-a-thing form. Then in Supabase → **Table Editor** → **`submissions`**, confirm a new row appeared.
- [ ] **Email test:** sign up for the digest with your own email. Confirm a new row in the **`subscribers`** table *and* that a confirmation email arrives in your inbox.

---

# Phase 8 — The nightly autopilot and your approval screen

**Goal:** the automation that keeps the app fresh with almost no daily work — it gathers content, has Claude write the blurbs/tags overnight, and shows it to you to approve in one tap. This is **Document 9, Stage 2, done automatically.**

**🧑 YOU — set up the app's own AI key and the schedule:**
1. **The app's Claude key (different from your Claude Code login):** go to **platform.claude.com** (the Anthropic Console), sign in, click **API Keys** → **Create Key**, and copy it (starts with `sk-ant-`). Paste it to Claude Code as a **secret** when asked. *This is billed per use and is separate from your subscription.*
2. **Your Supabase secret key:** in Supabase → **Project Settings → API Keys**, copy the **Secret key** (`sb_secret_…`; or the legacy **service_role** key if that's what you see). This one is powerful — only paste it where Claude Code tells you (server-side), **never** into a public place.
3. **Turn on the schedule:** Claude will tell you to set your **Vercel** project to the **Pro** plan (needed for scheduled jobs) and will set the nightly timer for you.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md, the architecture doc, Document 9, and Phase 8. Build the nightly pipeline: one scheduled job that gathers facts, batch-enriches them with the Claude API on the cheapest model to add blurbs/tags/tier/category — using ONLY the facts provided, never inventing places, dates, or times — and stages them for review. Then build an admin "cockpit" screen where I approve or reject each item in one tap before it goes live. Plan mode first.

**✅ Check it worked — Phase 8 is done when:**
- [ ] You can **trigger the job manually** (Claude shows you how) and watch new items appear in the approval screen.
- [ ] The **cockpit** screen lists staged items with their AI-written blurbs and tags.
- [ ] You can **approve/reject**, and only **approved** items show up in the public app.
- [ ] **Spot-check (important):** pick a few items and confirm the AI **did not invent** an address or time — compare against the real source (per Document 9).
- [ ] The **nightly schedule** is set (Claude confirms the timer) and will run on its own.

---

# Phase 9 — Launch (make it installable, accessible, real, and live)

**Goal:** the app installs to a phone like a real app, works for everyone, is fast, runs on your own web address, and is filled with **real** Santa Barbara content.

**🧑 YOU:**
1. **Real content:** open **Document 9** and run **Stage 2** for real — the ~100–150 verified things. (This is the one slow, human part. Quality over quantity.)
2. **Your web address:** in Vercel → your project → **Settings → Domains**, you can buy or connect a custom domain (like `sbdaymaker.com`). Claude will walk you through it.

> **🤖 Kickoff prompt:**
> Read CLAUDE.md and Phase 9. Make SB Daymaker an installable app (PWA — home-screen install + offline shell), run an accessibility pass to the WCAG 2.2 AA standard (color contrast, labels, keyboard use, reduced motion), speed it up, and prepare the production launch on my custom domain. Give me a final pre-launch checklist and walk me through the domain step. Plan mode first.

**✅ Check it worked — Phase 9 is done when:**
- [ ] **Install test:** open the app on your phone's browser, use the browser menu, and choose **"Add to Home Screen."** It appears as an icon and opens full-screen like a real app.
- [ ] **Real content** is loaded and the practice fixtures are deleted (the feed shows real places).
- [ ] **Accessibility:** ask Claude to *"run an accessibility check and show me the results"* — it should report a pass (or fix what it finds). Eyeball it too: text is easy to read, buttons are easy to tap.
- [ ] **Speed:** the app loads quickly on your phone on cellular data, not just wifi.
- [ ] **It's live on your own domain** (not just the `.vercel.app` address). 🎉 **You launched.**

---

## When something goes wrong (it will, and that's normal)

- **A red error message appeared:** select the whole message, copy it, paste it into the Claude Code chat, and type *"this errored — please fix it."* Repeat until it's clean. You don't need to understand the error.
- **A change made the app worse:** type *"undo your last change"* or use Claude Code's **rewind** to return to when it worked, then try again with a clearer request.
- **Claude built the wrong thing** (e.g., a Map or My Plan): type *"that's removed in v9 — re-read CLAUDE.md and redo the plan."*
- **A website's buttons don't match this guide:** describe what you see to Claude Code and ask it to walk you to the right spot. Sites change; the guide can't predict every redesign.
- **You're not sure a phase is truly done:** if any checklist box is unticked, it's not done. Don't move on — fixing it now is far easier than later.

## What's deliberately saved for after launch (Phase 2)

The full map, push notifications, the operator-photo program, paid sponsor placements, and the richer seasonal recap. **None of these block launch.** Ship the three-tab core, prove people open it daily, then expand.

*End of Build Plan. Keep `CLAUDE.md` (the rules), `09` (seeding), and the Credentials file open beside you. Build one phase at a time, and tick every box.*
