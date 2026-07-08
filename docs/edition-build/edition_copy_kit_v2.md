# SB Daymaker · Edition · Voice & Copy Kit (v2)

`Phase 3 deliverable, revised · the words. Fixed chrome + the static pools.`

## The voice (one paragraph)

A knowing local friend, writing you down. Warm, dry, specific, a little understated. Never corporate, never breathless. No exclamation marks. No "don't miss," no "amazing," no hype. Active voice, sentence case, plain verbs. Contractions stay (it's a friend, not a press release). When in doubt, say the true thing plainly rather than the clever thing loudly. The confidence is in the restraint: we don't need to sell it, we just tell you where we'd go.

**Person: "we".** A knowing publication, warm and inclusive (the founder's own family-man point of view rides comfortably inside "we").

---

## 0. HARD RULES (non-negotiable)

1. **Em dashes ( — ) are never used. Anywhere. Under any circumstances.** Not in subjects, preheaders, greetings, blurbs, chrome, or any founder-added line. Use a period, comma, colon, semicolon, or parentheses instead.
2. **The ban covers the assembled output, not just these pools.** Reused fields (`blurb`, `blurb_long`, `local_note`, `reason_to_go`) were AI-drafted upstream and could contain an em dash. So:
   - the batch drafting step is configured to never emit em dashes, and the approval/lint step flags any that slip through, **and**
   - the renderer runs a final normalization pass that strips any em dash from every assembled string before send (belt and suspenders). *(Phase-6 renderer requirement.)*
3. **Long dashes generally:** to avoid any ambiguity, ranges use "to" or a hyphen (e.g. "Fri to Sun," "5 to 6 pm"), not en dashes. If you want to allow en dashes in numeric ranges, say so and I'll relax this; the default is zero long dashes of any kind.
4. **The blind-template rule:** every pooled line must be true for *any* issue. No line asserts weather, season, or a specific happening. Specificity comes only from the allowlisted tokens.

---

## 1. Substitution + selection (recap)

- **Allowlisted tokens only:** `{hero_title}` · `{hero_neighborhood}` · `{hero_when}` · `{edition_weekday}` · `{window_label}` · `{pick_count}` *(= number of secondary picks, normally 3)*.
- **Deterministic pick:** `index = stableHash(edition_id) % eligible_pool.length`. Same issue, same line, every render. No randomness, no model.
- **Eligibility filter:** `[token]` lines need their token present; `[safe]` lines always qualify; `[evergreen]` lines are the only ones eligible when the hero is an evergreen fallback (quiet week), so we never promise a marquee event that isn't there.

---

## 2. Subject lines

### Thursday · event-forward
- `This weekend: {hero_title}` · [token]
- `{hero_title}, and {pick_count} more worth it` · [token]
- `If you do one thing this weekend: {hero_title}` · [token]
- `Start in {hero_neighborhood} this weekend` · [token]
- `Worth leaving the house for: {hero_title}` · [token]
- `Your weekend in Santa Barbara` · [safe]
- `A few things worth doing this weekend` · [safe]
- `Here's the weekend` · [safe]
- `The weekend, sorted` · [safe]
- `A quiet one this weekend? Here's where we'd be` · [evergreen]
- `Slow weekend, good options` · [evergreen]
- `Nothing loud this weekend, but still worth getting out` · [evergreen]

### Sunday · discovery-forward
- `The week ahead: {hero_title}` · [token]
- `This week, start with {hero_title}` · [token]
- `{hero_neighborhood}, and a few reasons to get out this week` · [token]
- `Santa Barbara, Monday to Thursday` · [safe]
- `Your week ahead in SB` · [safe]
- `The week ahead, and where to wander` · [safe]
- `A few things, and a corner of SB worth exploring` · [safe]
- `Slower week, better excuses to get out` · [safe/evergreen]
- `This week: a corner of SB worth your time` · [evergreen]
- `Nowhere to be? Somewhere to go.` · [evergreen]

---

## 3. Preheaders

### Thursday
- `The Move, three more picks, and where to point your weekend.` · [safe]
- `Our shortlist for the next three days.` · [safe]
- `{hero_neighborhood} and a few more worth the trip.` · [token]
- `Everything worth leaving the couch for, in one scroll.` · [safe]
- `Hand-picked, no filler.` · [safe]
- `A calmer one this week. Still worth it.` · [evergreen]

### Sunday
- `Your Monday to Thursday, plus somewhere worth exploring.` · [safe]
- `A lighter week, and a corner of SB to wander.` · [safe]
- `The week ahead, and a place worth the detour.` · [safe]
- `What's on, and where to explore.` · [safe]
- `Quieter days, good excuses to get out.` · [evergreen]

---

## 4. Greetings

### Thursday
- `Here's what's worth doing, {window_label}.` · [token]
- `{hero_neighborhood} is where we'd start this weekend.` · [token]
- `Three days ahead. Here's the shortlist.` · [safe]
- `The good stuff for the weekend. No filler.` · [safe]
- `A few things worth leaving the house for.` · [safe]
- `Quieter weekend than most, but we found the good corners.` · [evergreen]

### Sunday
- `Here's the week ahead, and a corner of SB worth your time.` · [safe]
- `Slower stretch of the week. Good time to explore.` · [safe]
- `Monday through Thursday, plus somewhere to wander.` · [safe]
- `{hero_neighborhood} is worth a look this week.` · [token]
- `Not much on the calendar, which is the best time to get out.` · [evergreen]

---

## 5. Fixed chrome

| Slot | Copy |
|---|---|
| Wordmark | `SB Daymaker` |
| Hero eyebrow | `THE MOVE` |
| Secondaries section label | Thu: `Also this weekend` · Sun: `Also this week` |
| Non-event segment label | Thu: `New this week` · Sun: `Worth exploring` |
| Evergreen anchor label | `Always worth it` |
| Sponsor label | `Sponsored` |
| Pick CTA | `See it →` |
| Forward loop · heading | `Know someone new to town?` |
| Forward loop · line | `Forward this along. SB Daymaker tells them what's worth doing in Santa Barbara, twice a week.` |
| Forward loop · subscribe CTA | `Get it in your inbox →` |
| Footer · reason for receiving | `You're getting this because you asked SB Daymaker what's worth doing in Santa Barbara.` |
| Footer · cadence note | `Two a week: Thursday and Sunday. No more than that.` |
| Unsubscribe | `Unsubscribe` |
| Footer · address | `SB Daymaker · 78 Brandon Drive, Goleta, CA 93117` |

---

## 6. Derived micro-patterns

- **Image alt text:** `{hero_title}` when there's no attribution; `{hero_title} (photo: {photo_attribution})` when there is.
- **Local's Secret prefix** *(chrome, on the conditional hero line)*: `Local's secret: ` + the reused `local_note`.
- **When-string** stays fully derived (`whenString`), rendered with "to" for ranges, not a long dash.

---

## 7. Notes / flags

- **Person: settled as "we."**
- **Physical mailing address:** confirmed as `78 Brandon Drive, Goleta, CA 93117` (CAN-SPAM requirement satisfied).
- **En dash question is open:** default bans all long dashes (ranges use "to"). Tell me if you'd rather permit en dashes in pure numeric ranges.
- **`{pick_count}` = secondary picks** (normally 3). Thin weeks that drop it read fine ("and 2 more"); if it ever hits 1 or 0, the token lines fall out of eligibility and a `[safe]`/`[evergreen]` line is chosen.
- **Sponsor label wording** may want revisiting when the sponsor slot ships.
- These pools are a launch set. Add lines anytime, as long as each obeys the hard rules above.

---

**Checkpoint:** approve the copy kit v2, or flag any line. The em dash ban is embedded (§0) and every string here is clean. Back to Phase 4 iteration on the mockup whenever you're ready.
