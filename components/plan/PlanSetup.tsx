"use client";

import { useMemo, useState, type ReactNode } from "react";
import { PlanHeader } from "./PlanHeader";
import {
  todayISO,
  shiftISO,
  nextDays,
  dayParts,
  fullDayLabel,
} from "@/lib/plan/dates";
import type {
  PlanAnswers,
  Block,
  Who,
  KidBand,
  Transport,
  Budget,
  Meal,
} from "@/lib/plan/types";
import type { Zone } from "@/lib/zones";

// Gate 4 · The Concierge Day setup is a guided interview (one question per
// screen, auto-advancing single-selects), not a filter form. It collects the
// same PlanAnswers the deterministic engine already consumes; nothing about the
// engine changes. No em dash (Golden Rule).

type WhenChoice = "today" | "tomorrow" | "pick";

// The 7 core questions. `kids` is a sub-step of `who` (Family only) and shares
// the Who progress dot, so the dot count stays 7.
type Step =
  | "intro"
  | "when"
  | "tod"
  | "who"
  | "kids"
  | "where"
  | "transport"
  | "budget"
  | "meals";

const DOT_STEPS: Step[] = ["when", "tod", "who", "where", "transport", "budget", "meals"];
const DOT_OF: Partial<Record<Step, number>> = {
  when: 0, tod: 1, who: 2, kids: 2, where: 3, transport: 4, budget: 5, meals: 6,
};

const PERIODS: { value: Block; glyph: string; label: string; desc: string }[] = [
  { value: "morning",   glyph: "🌅", label: "Morning", desc: "Coffee, a walk, the marine layer burning off" },
  { value: "afternoon", glyph: "⛅", label: "Afternoon", desc: "The heart of the day" },
  { value: "night",     glyph: "🌙", label: "Night", desc: "Dinner, a show, a nightcap" },
];

const WHO: { value: Who; glyph: string; label: string; desc: string }[] = [
  { value: "couple", glyph: "💞", label: "Couple", desc: "A day for two" },
  { value: "family", glyph: "👨‍👩‍👧", label: "Family with kids", desc: "We'll ask their ages" },
  { value: "solo", glyph: "🚶", label: "Solo", desc: "Your own pace" },
  { value: "friends", glyph: "🥂", label: "Group of friends", desc: "The more the merrier" },
];

const KID_BANDS: { value: KidBand; glyph: string; label: string; desc: string }[] = [
  { value: "toddler", glyph: "🧸", label: "Toddler (0 to 3)", desc: "Short loops, stroller-friendly, no late nights" },
  { value: "young", glyph: "🎈", label: "Young kids (4 to 9)", desc: "Hands-on, room to run" },
  { value: "tweens", glyph: "🛹", label: "Tweens and up (10+)", desc: "They can hang with the grown-up stuff" },
];

const ZONE_OPTS: { value: Zone | null; glyph: string; label: string; desc: string }[] = [
  { value: null, glyph: "🧭", label: "Anywhere", desc: "Surprise me, all of Santa Barbara" },
  { value: "downtown", glyph: "🏛️", label: "Downtown / State St", desc: "The old town, walkable core" },
  { value: "funk", glyph: "🍇", label: "Funk Zone", desc: "Wine, murals, harbor-adjacent" },
  { value: "waterfront", glyph: "🌊", label: "The Waterfront", desc: "Beach, pier, the harbor" },
  { value: "mesa", glyph: "🌅", label: "The Mesa", desc: "Cliffs, quiet, local" },
  { value: "montecito", glyph: "🌳", label: "Montecito", desc: "Coast Village, upscale calm" },
  { value: "goleta", glyph: "🏖️", label: "Goleta", desc: "West of town, more room" },
];

const TRANSPORTS: { value: Transport; glyph: string; label: string; desc: string }[] = [
  { value: "walk", glyph: "🚶", label: "On foot", desc: "Park once, walk the rest" },
  { value: "car", glyph: "🚗", label: "Car", desc: "Opens Goleta, Montecito, the coast" },
  { value: "bike", glyph: "🚲", label: "Bike", desc: "Waterfront-path friendly" },
];

const BUDGETS: { value: Budget; glyph: string; label: string; desc: string }[] = [
  { value: "cheap", glyph: "🪙", label: "Keep it cheap", desc: "Free and $ mostly" },
  { value: "mid", glyph: "💳", label: "Middle, one splurge", desc: "$$ with a treat" },
  { value: "treat", glyph: "✨", label: "Treat ourselves", desc: "$$$ welcome" },
];

type MealChoice = "lunch" | "lunch_dinner" | "all" | "none";
const MEAL_PRESETS: { value: MealChoice; glyph: string; label: string; desc: string; meals: Meal[] }[] = [
  { value: "lunch", glyph: "🥗", label: "Just lunch", desc: "One meal in the middle", meals: ["lunch"] },
  { value: "lunch_dinner", glyph: "🍽️", label: "Lunch and dinner", desc: "Two anchors", meals: ["lunch", "dinner"] },
  { value: "all", glyph: "☕", label: "Breakfast through dinner", desc: "The full day", meals: ["breakfast", "lunch", "dinner"] },
  { value: "none", glyph: "🚫", label: "No meals", desc: "We'll figure food out", meals: [] },
];

const ALL_PERIODS: Block[] = ["morning", "afternoon", "night"];
const ADVANCE_MS = 170;

// ---- Module-level presentational helpers (stable component identity) --------

interface OptionRow { key: string; glyph: string; label: string; desc?: string }

function StepShell({
  step,
  onBack,
  kicker,
  question,
  sub,
  children,
}: {
  step: Step;
  onBack: () => void;
  kicker: string;
  question: string;
  sub: string;
  children: ReactNode;
}) {
  const dotIdx = DOT_OF[step] ?? 0;
  return (
    <main id="main" className="sbd-shell__main sbd-wiz">
      <div className="sbd-wiz__top">
        <button type="button" className="sbd-wiz__back" onClick={onBack} aria-label="Back">
          ‹
        </button>
        <div
          className="sbd-wiz__dots"
          role="progressbar"
          aria-valuenow={dotIdx + 1}
          aria-valuemin={1}
          aria-valuemax={DOT_STEPS.length}
        >
          {DOT_STEPS.map((_, i) => (
            <span key={i} className={`sbd-wiz__dot${i === dotIdx ? " sbd-wiz__dot--on" : ""}`} aria-hidden="true" />
          ))}
        </div>
        <span className="sbd-wiz__count">{kicker}</span>
      </div>
      <h1 className="sbd-wiz__q">{question}</h1>
      <p className="sbd-wiz__sub">{sub}</p>
      {children}
    </main>
  );
}

// Single-select option list (auto-advancing). `pending` disables all rows while
// the brief advance highlight plays.
function OptList({
  ariaLabel,
  options,
  isSelected,
  onSelect,
  pending,
}: {
  ariaLabel: string;
  options: OptionRow[];
  isSelected: (key: string) => boolean;
  onSelect: (key: string) => void;
  pending: string | null;
}) {
  return (
    <div className="sbd-optlist" role="group" aria-label={ariaLabel}>
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          className={`sbd-opt${pending === o.key ? " sbd-opt--pending" : ""}`}
          aria-pressed={isSelected(o.key)}
          disabled={pending !== null}
          onClick={() => onSelect(o.key)}
        >
          <span className="sbd-opt__ic" aria-hidden="true">{o.glyph}</span>
          <span className="sbd-opt__tx">
            <span className="sbd-opt__lab">{o.label}</span>
            {o.desc ? <span className="sbd-opt__desc">{o.desc}</span> : null}
          </span>
          <span className="sbd-opt__chev" aria-hidden="true">›</span>
        </button>
      ))}
    </div>
  );
}

export interface ShowDayOptions {
  blank?: boolean;
}

interface PlanSetupProps {
  onShowDay: (answers: PlanAnswers, opts?: ShowDayOptions) => void;
}

export function PlanSetup({ onShowDay }: PlanSetupProps) {
  const [step, setStep] = useState<Step>("intro");
  const [when, setWhen] = useState<WhenChoice>("today");
  const [pickDate, setPickDate] = useState<string>(todayISO());
  const [pickOpen, setPickOpen] = useState(false);
  const [periods, setPeriods] = useState<Block[]>([]);
  const [who, setWho] = useState<Who | null>(null);
  const [kidBand, setKidBand] = useState<KidBand | null>(null);
  const [zone, setZone] = useState<Zone | null>(null);
  const [transport, setTransport] = useState<Transport>("car");
  const [budget, setBudget] = useState<Budget | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  const dateISO = useMemo(() => {
    if (when === "tomorrow") return shiftISO(todayISO(), 1);
    if (when === "pick") return pickDate;
    return todayISO();
  }, [when, pickDate]);
  const dayChoices = useMemo(() => nextDays(14), []);

  // Advance with a brief highlight so the tap registers before the screen turns.
  function advance(key: string, to: Step) {
    setPending(key);
    setTimeout(() => {
      setPending(null);
      setStep(to);
    }, ADVANCE_MS);
  }

  function back() {
    switch (step) {
      case "when": setStep("intro"); break;
      case "tod": setStep("when"); break;
      case "who": setStep("tod"); break;
      case "kids": setStep("who"); break;
      case "where": setStep(who === "family" ? "kids" : "who"); break;
      case "transport": setStep("where"); break;
      case "budget": setStep("transport"); break;
      case "meals": setStep("budget"); break;
      default: setStep("intro");
    }
  }

  function finish(meals: Meal[] | undefined, blank = false) {
    onShowDay(
      {
        dateISO,
        periods: periods.length ? periods : ALL_PERIODS,
        who: who ?? "friends",
        vibes: [], // vibe/pace auto-derived (DEFAULT_PRIOR + kid-band pacing)
        zone,
        kidBand: who === "family" ? kidBand : null,
        transport,
        budget,
        meals,
        pace: "slow",
      },
      { blank },
    );
  }

  // Express paths from the intro (sensible defaults, straight to the spine).
  function expressBuild(blank: boolean) {
    onShowDay(
      {
        dateISO: todayISO(),
        periods: ALL_PERIODS,
        who: "friends",
        vibes: [],
        zone: null,
        kidBand: null,
        transport: "car",
        budget: null,
        meals: undefined, // inferred from periods
        pace: "slow",
      },
      { blank },
    );
  }

  function togglePeriod(p: Block) {
    setPeriods((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));
  }

  // ---- Intro --------------------------------------------------------------
  if (step === "intro") {
    return (
      <>
        <PlanHeader />
        <main id="main" className="sbd-shell__main sbd-wizintro">
          <div className="sbd-wizintro__hero">
            <p className="sbd-wizintro__eyebrow">The concierge day</p>
            <h1 className="sbd-wizintro__title">Tell us the shape, we&rsquo;ll draft the day.</h1>
            <p className="sbd-wizintro__sub">
              A handful of taps and you get a Santa Barbara day that actually works:
              open when it says, clustered so you&rsquo;re not driving in circles, parked
              where a local parks, fed at mealtimes.
            </p>
            <button
              type="button"
              className="sbd-btn sbd-btn--primary sbd-btn--block sbd-wizintro__cta"
              onClick={() => setStep("when")}
            >
              Build my day →
            </button>
            <div className="sbd-wizintro__row">
              <button type="button" className="sbd-wizintro__link" onClick={() => expressBuild(false)}>
                Just draft me something
              </button>
              <span aria-hidden="true">·</span>
              <button type="button" className="sbd-wizintro__link" onClick={() => expressBuild(true)}>
                Start from a blank day
              </button>
            </div>
          </div>
          <ul className="sbd-wizintro__diff" aria-label="What makes it different">
            <li>Every stop is open when we schedule it</li>
            <li>Clustered so you&rsquo;re not driving in circles</li>
            <li>Parking and lunch built in, shareable in one link</li>
          </ul>
        </main>
      </>
    );
  }

  // ---- When ---------------------------------------------------------------
  if (step === "when") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 1 of 7" question="When are you out?" sub="This drives which dated events can land in your day.">
        <OptList
          ariaLabel="When are you out?"
          pending={pending}
          options={[
            { key: "today", glyph: "☀️", label: "Today" },
            { key: "tomorrow", glyph: "🌤️", label: "Tomorrow" },
            { key: "pick", glyph: "📅", label: "Pick a date", desc: pickOpen ? undefined : "Choose any day in the next two weeks" },
          ]}
          isSelected={(k) => when === k}
          onSelect={(k) => {
            if (k === "pick") {
              setWhen("pick");
              setPickOpen(true);
              return; // stay so the user can choose a date, then Next
            }
            setWhen(k as WhenChoice);
            setPickOpen(false);
            advance(k, "tod");
          }}
        />
        {when === "pick" && pickOpen ? (
          <>
            <div className="sbd-q__days" role="group" aria-label="Choose a date">
              {dayChoices.map((iso, i) => {
                const { wd, day, mon } = dayParts(iso);
                const prevMon = i > 0 ? dayParts(dayChoices[i - 1]).mon : null;
                return (
                  <button
                    key={iso}
                    type="button"
                    className="sbd-daychip"
                    aria-pressed={pickDate === iso}
                    aria-label={fullDayLabel(iso)}
                    onClick={() => setPickDate(iso)}
                  >
                    <span className="sbd-daychip__wd" aria-hidden="true">{mon !== prevMon ? mon : wd}</span>
                    <span className="sbd-daychip__d" aria-hidden="true">{day}</span>
                  </button>
                );
              })}
            </div>
            <button type="button" className="sbd-btn sbd-btn--primary sbd-btn--block sbd-wiz__next" onClick={() => setStep("tod")}>
              Next →
            </button>
          </>
        ) : null}
      </StepShell>
    );
  }

  // ---- Time of day (multi-select -> Next) ---------------------------------
  if (step === "tod") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 2 of 7" question="Which parts of the day?" sub="Pick one or more. These become the sections of your day.">
        <div className="sbd-optlist" role="group" aria-label="Which parts of the day?">
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className="sbd-opt"
              aria-pressed={periods.includes(p.value)}
              onClick={() => togglePeriod(p.value)}
            >
              <span className="sbd-opt__ic" aria-hidden="true">{p.glyph}</span>
              <span className="sbd-opt__tx">
                <span className="sbd-opt__lab">{p.label}</span>
                <span className="sbd-opt__desc">{p.desc}</span>
              </span>
              <span className="sbd-opt__check" aria-hidden="true">{periods.includes(p.value) ? "✓" : ""}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="sbd-btn sbd-btn--primary sbd-btn--block sbd-wiz__next"
          disabled={periods.length === 0}
          aria-disabled={periods.length === 0}
          onClick={() => setStep("who")}
        >
          Next →
        </button>
      </StepShell>
    );
  }

  // ---- Who ----------------------------------------------------------------
  if (step === "who") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 3 of 7" question="Who's coming?" sub="This shapes the pace and rules out the wrong stops.">
        <OptList
          ariaLabel="Who's coming?"
          pending={pending}
          options={WHO.map((w) => ({ key: w.value, glyph: w.glyph, label: w.label, desc: w.desc }))}
          isSelected={(k) => who === k}
          onSelect={(k) => {
            const w = k as Who;
            setWho(w);
            if (w !== "family") setKidBand(null);
            advance(k, w === "family" ? "kids" : "where");
          }}
        />
      </StepShell>
    );
  }

  // ---- Kid age (Family only) ---------------------------------------------
  if (step === "kids") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 3 of 7" question="How old are the kids?" sub="Toddlers get nap-window pacing and no late nights.">
        <OptList
          ariaLabel="How old are the kids?"
          pending={pending}
          options={KID_BANDS.map((k) => ({ key: k.value, glyph: k.glyph, label: k.label, desc: k.desc }))}
          isSelected={(k) => kidBand === k}
          onSelect={(k) => {
            setKidBand(k as KidBand);
            advance(k, "where");
          }}
        />
      </StepShell>
    );
  }

  // ---- Where (anchor) -----------------------------------------------------
  if (step === "where") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 4 of 7" question="Where are you starting?" sub="We cluster the day around this and route from it.">
        <OptList
          ariaLabel="Where are you starting?"
          pending={pending}
          options={ZONE_OPTS.map((z) => ({ key: z.label, glyph: z.glyph, label: z.label, desc: z.desc }))}
          isSelected={(k) => (ZONE_OPTS.find((z) => z.label === k)?.value ?? null) === zone}
          onSelect={(k) => {
            const opt = ZONE_OPTS.find((z) => z.label === k);
            setZone(opt?.value ?? null);
            advance(k, "transport");
          }}
        />
      </StepShell>
    );
  }

  // ---- Transport ----------------------------------------------------------
  if (step === "transport") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 5 of 7" question="Getting around?" sub="Walking keeps it to one neighborhood; a car unlocks the coast.">
        <OptList
          ariaLabel="Getting around?"
          pending={pending}
          options={TRANSPORTS.map((t) => ({ key: t.value, glyph: t.glyph, label: t.label, desc: t.desc }))}
          isSelected={(k) => transport === k}
          onSelect={(k) => {
            setTransport(k as Transport);
            advance(k, "budget");
          }}
        />
      </StepShell>
    );
  }

  // ---- Budget -------------------------------------------------------------
  if (step === "budget") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 6 of 7" question="Budget for the day?" sub="We won't seat you at three splurges by accident.">
        <OptList
          ariaLabel="Budget for the day?"
          pending={pending}
          options={BUDGETS.map((b) => ({ key: b.value, glyph: b.glyph, label: b.label, desc: b.desc }))}
          isSelected={(k) => budget === k}
          onSelect={(k) => {
            setBudget(k as Budget);
            advance(k, "meals");
          }}
        />
      </StepShell>
    );
  }

  // ---- Meals (final -> build) --------------------------------------------
  if (step === "meals") {
    return (
      <StepShell step={step} onBack={back} kicker="Step 7 of 7" question="Which meals should we plan?" sub="A plan without a meal at mealtime isn't a plan.">
        <OptList
          ariaLabel="Which meals should we plan?"
          pending={pending}
          options={MEAL_PRESETS.map((m) => ({ key: m.value, glyph: m.glyph, label: m.label, desc: m.desc }))}
          isSelected={() => false}
          onSelect={(k) => {
            const preset = MEAL_PRESETS.find((m) => m.value === k)!;
            setPending(k);
            setTimeout(() => finish(preset.meals), ADVANCE_MS);
          }}
        />
      </StepShell>
    );
  }

  return null;
}
