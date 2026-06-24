# SB Daymaker — Pre-Launch Checklist

Work top to bottom. ✅ each box before going live.

## 1. Content
- [ ] Real content loaded (~107 things); **practice fixtures + demo rows deleted** (done in Phase 9 prep).
- [ ] Items reviewed and **published** (cockpit approve, or bulk `update things set status='published' where status='needs_review';`).
- [ ] Spot-check 5 random things in Google Maps (addresses real) + 3 event times against their source.
- [ ] At least one **neighborhood guide** and one **theme guide** published, if you want Discover SB populated (optional for launch).

## 2. Environment variables (Vercel → Settings → Environment Variables)
Add all of these for **Production** (same values as your local `.env.local`):
- [ ] `NEXT_PUBLIC_SUPABASE_URL`
- [ ] `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- [ ] `SUPABASE_SECRET_KEY` 🔴
- [ ] `ANTHROPIC_API_KEY` 🔴
- [ ] `RESEND_API_KEY` 🔴
- [ ] `CRON_SECRET`
- [ ] `NEXT_PUBLIC_SITE_URL` = your final domain (e.g. `https://sbdaymaker.com`)
- [ ] Redeploy after adding (push, or Vercel → Deployments → Redeploy).

## 3. Plan / billing
- [ ] Vercel project on **Pro** (required for the nightly + reaper cron schedules).
- [ ] Supabase on **Pro** by launch (backups; no 7-day pause).

## 4. PWA install
- [ ] On your phone, open the live site → browser menu → **Add to Home Screen** → opens full-screen with the SB Daymaker icon.
- [ ] DevTools → Application → Manifest + Service Worker both present; toggle **Offline**, reload → the offline screen shows (not a browser error).

## 5. Accessibility + performance
- [ ] Chrome DevTools → **Lighthouse** on `/` and a guide page → **Accessibility** and **PWA** green; **Performance** strong.
- [ ] Tab through `/` with the keyboard: skip-link appears, focus rings visible, every control reachable.
- [ ] Turn on OS **Reduce Motion** → sun pulse / shimmer / card pops stop.

## 6. Domain (Vercel → Settings → Domains)
- [ ] Domain added and showing **Valid Configuration** (DNS records set / bought through Vercel).
- [ ] Set as the **primary** domain; HTTPS certificate issued (automatic).
- [ ] `NEXT_PUBLIC_SITE_URL` updated to the domain + redeployed.
- [ ] Open the domain on your phone → the app loads over HTTPS.

## 7. Email (Resend)
- [ ] Verify a **sending domain** in Resend (DNS records) so digest/confirm emails reach anyone — until then, test mode only delivers to your own address.
- [ ] Optionally set `RESEND_FROM` (e.g. `SB Daymaker <hello@sbdaymaker.com>`) in Vercel.
- [ ] Test the digest signup with a non-owner email after domain verification.

## 8. Final smoke test (on the live domain)
- [ ] Explore: hero + feed render with real content; tags, Near Me, horizon all work.
- [ ] Tap a card → detail page; **Get tickets** opens the external site.
- [ ] Save a few → Saved shows them; share a list → open `/s/<token>` in a private window → "Save your own copy" works.
- [ ] Cockpit: log in, run the pipeline, approve an item → it appears live.

## 9. Right-after-launch fast-follows (tracked)
- [ ] **Cockpit 2FA** (TOTP) — deferred by choice; do this first post-launch.
- [ ] Watch the first nightly cron run (Vercel → Deployments → Functions logs / `audit_log`).
- [ ] When real **photos** are added to things, give each a meaningful `alt`.

🎉 When 1–8 are checked, you're live.
