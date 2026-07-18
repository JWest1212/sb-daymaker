// lib/heroServer.ts
//
// Server-only Hero-plan reads (service role). Builds the next-14-days rail: each
// day's pin (+ validity), the ranker's projected "Auto" pick, and the valid
// candidates for the picker. Candidate eligibility uses the shared occursOnDate
// helper; ordering reuses the site's own cascade() ranker (never forked).
//
// NOTE: pins are founder INTENT. No edition-drafter consumes them yet (recon §6),
// so this stores/validates pins but nothing acts on them downstream, that awaits
// the edition-drafter build.

import "server-only";
import { getAdminSupabase } from "./supabaseAdmin";
import { cascade, pickAutoHero, sbDay } from "./explore";
import { occursOnDate } from "./occurrences";
import { whenString } from "./review";
import type { Thing } from "./things";

export interface HeroCandidate { id: string; title: string; tier: number; when: string; photo_url: string | null; }
export interface HeroDay {
  date: string;   // SB "YYYY-MM-DD"
  label: string;  // "Wed Jul 1"
  isToday: boolean;
  pin: { thing_id: string; title: string; tier: number; when: string; valid: boolean } | null;
  autoPick: HeroCandidate | null;
  candidates: HeroCandidate[];
}
export interface HeroPlan { days: HeroDay[]; generatedAt: string }

const LABEL_FMT = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", month: "short", day: "numeric" });
const STAR_SELECT =
  `id, title, happening_tier, editorial_weight, starts_at, status, hero_eligible, photo_url,
   recurring_schedules ( day_of_week, start_time, end_time, frequency, label )`;

interface StarRow {
  id: string; title: string; happening_tier: number; editorial_weight: number; starts_at: string | null;
  status: string; hero_eligible: boolean; photo_url: string | null;
  recurring_schedules: { day_of_week: number | null; start_time: string | null; end_time: string | null; frequency: string | null; label: string | null }[] | null;
}

function sbDatesFrom(now: number, n: number) {
  const [y, m, d] = sbDay(now).split("-").map(Number);
  const out: { date: string; label: string; isToday: boolean }[] = [];
  for (let i = 0; i < n; i++) {
    const dt = new Date(Date.UTC(y, m - 1, d + i, 12));
    out.push({ date: sbDay(dt.getTime()), label: LABEL_FMT.format(dt), isToday: i === 0 });
  }
  return out;
}

const occThing = (r: StarRow) => ({ happening_tier: Number(r.happening_tier), starts_at: r.starts_at, recurring: r.recurring_schedules ?? [] });
const toCandidate = (r: StarRow): HeroCandidate => ({
  id: r.id, title: r.title, tier: Number(r.happening_tier), photo_url: r.photo_url,
  when: whenString(Number(r.happening_tier), r.starts_at, r.recurring_schedules ?? []),
});

export async function loadHeroPlan(now: number = Date.now()): Promise<HeroPlan> {
  const generatedAt = new Date(now).toISOString();
  const sb = getAdminSupabase();
  if (!sb) return { days: [], generatedAt };

  const days = sbDatesFrom(now, 14);
  const dateStrs = days.map((d) => d.date);

  const [pinsRes, starRes] = await Promise.all([
    sb.from("hero_pins").select("pin_date, thing_id").in("pin_date", dateStrs),
    sb.from("things").select(STAR_SELECT).eq("status", "published").eq("hero_eligible", true),
  ]);
  const pinByDate = new Map<string, string>();
  for (const p of pinsRes.data ?? []) pinByDate.set(p.pin_date as string, p.thing_id as string);
  const stars = (starRes.data ?? []) as unknown as StarRow[];

  // Pinned things may have lost hero_eligible / been archived / had their date change, // fetch their current rows so validity is computed from ground truth.
  const pinnedIds = [...new Set([...pinByDate.values()])];
  const pinnedById = new Map<string, StarRow>();
  if (pinnedIds.length) {
    const { data } = await sb.from("things").select(STAR_SELECT).in("id", pinnedIds);
    for (const r of (data ?? []) as unknown as StarRow[]) pinnedById.set(r.id, r);
  }

  const out: HeroDay[] = days.map(({ date, label, isToday }) => {
    const dayCands = stars.filter((s) => occursOnDate(occThing(s), date));
    const orderedThings = cascade(dayCands as unknown as Thing[]);
    const ordered = orderedThings as unknown as StarRow[];
    const candidates = ordered.map(toCandidate);
    // W2.1a: the projected "Auto" pick imports the site's own hero picker (never
    // forked) so the cockpit rail shows exactly what the public hero will choose, // a founder-boosted Tier-1 item on this date wins over the plain soonest card.
    const picked = pickAutoHero(orderedThings, date);
    const autoPick = picked ? toCandidate(picked as unknown as StarRow) : null;

    let pin: HeroDay["pin"] = null;
    const pinnedId = pinByDate.get(date);
    if (pinnedId) {
      const row = pinnedById.get(pinnedId);
      const valid = !!row && row.status === "published" && !!row.hero_eligible && occursOnDate(occThing(row), date);
      pin = {
        thing_id: pinnedId,
        title: row?.title ?? "(removed)",
        tier: row ? Number(row.happening_tier) : 0,
        when: row ? whenString(Number(row.happening_tier), row.starts_at, row.recurring_schedules ?? []) : "",
        valid,
      };
    }
    return { date, label, isToday, pin, autoPick, candidates };
  });

  return { days: out, generatedAt };
}

/** Today's LIVE hero override: the thing_id of a valid pin for today, or null.
 *  Read by the public Explore hero path so same-day pins go live immediately.
 *  Deterministic + sponsor-blind (reads hero_pins only, never is_featured/sponsor_id), *  a founder pin is explicitly allowed curation (build plan §0.1). Fail-soft: any
 *  problem returns null and the ranker picks, so the public hero is never broken. */
export async function getLiveHeroPinId(now: number = Date.now()): Promise<string | null> {
  const sb = getAdminSupabase();
  if (!sb) return null;
  const today = sbDay(now);
  const { data: pin } = await sb.from("hero_pins").select("thing_id").eq("pin_date", today).maybeSingle();
  if (!pin?.thing_id) return null;
  const { data } = await sb.from("things").select(STAR_SELECT).eq("id", pin.thing_id as string).maybeSingle();
  const row = data as unknown as StarRow | null;
  if (!row || row.status !== "published" || !row.hero_eligible) return null;
  if (!occursOnDate(occThing(row), today)) return null;
  return row.id;
}

/** POST validation: a pin must be published, ⭑ hero-eligible, and actually occur on the date. */
export async function validatePin(pin_date: string, thing_id: string): Promise<{ ok: boolean; error?: string }> {
  const sb = getAdminSupabase();
  if (!sb) return { ok: false, error: "not configured" };
  const { data } = await sb.from("things").select(STAR_SELECT).eq("id", thing_id).single();
  const row = data as unknown as StarRow | null;
  if (!row) return { ok: false, error: "thing not found" };
  if (row.status !== "published") return { ok: false, error: "not published" };
  if (!row.hero_eligible) return { ok: false, error: "not hero-eligible (⭑), flag it first" };
  if (!occursOnDate(occThing(row), pin_date)) return { ok: false, error: "does not occur on that date" };
  return { ok: true };
}
