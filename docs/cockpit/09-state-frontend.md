# Section 10 - State Management and Frontend Logic

## 10.1 How state is managed

There is NO global state library, no server-state/cache library (no Redux/Zustand/React Query/SWR anywhere in package.json), and no React Context in the Cockpit. The pattern on every screen is identical:

1. A server component page does one service-role fetch (force-dynamic) and passes `initial` props to a single client view component.
2. The client view holds everything in local useState/useRef and mutates via plain fetch() to /api/admin/* or /api/review/*.
3. Freshness is per-navigation: switching tabs re-runs the server fetch; nothing polls, nothing subscribes, and two open tabs can hold divergent state until reloaded.

URL state: none beyond the route itself (filters, pagination, selected items, open sheets are all in-memory; a reload loses them). The topbar counts come from the layout's own fetch and refresh only on navigation (CMP-01 comment: "Counts are the latest-run snapshot from the server layout, they refresh on navigation").

## 10.2 Complex client-side logic (the pieces a redesign must not break)

- Optimistic commit + undo engine (CMP-05, SCR-01): the 2.6s COMMIT_MS delay, the pending Map of scheduled server calls, undo splice-back at original indexes, beforeunload flush with keepalive fetches. This is the most intricate state machine in the Cockpit; full detail in 03-components.md CMP-05 and the load-bearing list in 11-change-safety.md.
- Draft overlay rendering (CMP-05/CMP-06): pending edits live in a `Record<string, ReviewDraft>` keyed by thing id and are rendered OVER the stored row (dispTitle/dispBlurb etc.), diffed to produce the "Edited: ..." banner; nothing persists until Approve.
- Session assignment strip with revert (CMP-25, SCR-10): every image assignment records its `prev` photo (and whether a venue was attached this session) so Revert can restore the exact prior state, including a detach, and re-queue the row at the top.
- Chunked bulk pipelines in the browser (CMP-25): auto-free-all runs locate (batches of 25) -> prefetch (batches of 8) -> assign (chunks of 60) sequentially with progress text; auto-Google-all chunks by 60 and stops on capHit. These are long-lived client loops ("keep the tab open"); closing the tab abandons the remainder silently.
- Background prefetch de-duplication (CMP-25): a useRef Set guarantees each row's free-image prefetch fires at most once per session, batched 8 at a time per page.
- Optimistic-with-revert toggles: WeightNudge (CMP-03) and the hero pills (CMP-05/CMP-16) flip local state first and revert on a failed response.
- Debounced searches: catalog title filter (350ms, CMP-16), edition swap search (300ms, CMP-21).
- Stale-not-empty error handling (CMP-16): a failed list refresh keeps the last rows and shows a Retry banner instead of wiping the screen.
- Per-dimension cache (CMP-12): coverage results cached per dim ("vibe"/"zone") for the visit.
- Nonce-busted iframe (CMP-19): the edition preview iframe re-requests after every save via a `?v={n}` counter.
- Native window.confirm() is the only confirmation primitive (catalog delete/bulk archive, venue archive, all three Images bulk runs).

## 10.3 Optimism inventory (what lies to the operator and for how long)

| Action | Optimistic? | Failure surfacing |
|---|---|---|
| Queue approve/reject/bulk (SCR-01) | Yes, card leaves immediately; server call fires 2.6s later, fire-and-forget | NONE - response is never read; failure is invisible until the row reappears |
| Hero toggle (SCR-01) | Yes | none on SCR-01 (response ignored there); SCR-06's version reverts + toasts |
| Weight nudge | Yes | revert + toast |
| Catalog edit/photo/bulk, venue ops, edition saves, sweep/rhythm/source saves, flags | No (await response) | toast on failure (flags: silent, see SCR-11) |
| Images desk applies | No, but row removal + strip entry happen on success with in-session revert | toast |

## 10.4 Cross-references

Component-level detail lives in 03-components.md (CMP-01..CMP-28); per-screen keyboard maps and states in 04-screens.md; the behavioral risks of each pattern in 11-change-safety.md.
