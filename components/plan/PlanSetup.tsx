"use client";

import { useMemo, useState } from "react";
import { SegmentedControl, BottomSheet } from "@/components/ui";
import { PlanHeader } from "./PlanHeader";
import {
  todayISO,
  shiftISO,
  nextDays,
  dayParts,
  fullDayLabel,
} from "@/lib/plan/dates";
import type { PlanAnswers, Period, VibeKey, Who } from "@/lib/plan/types";
import type { Zone } from "@/lib/zones";

type WhenChoice = "today" | "tomorrow" | "pick";

const WHEN_OPTIONS = [
  { label: "Today", value: "today" },
  { label: "Tomorrow", value: "tomorrow" },
  { label: "📅 Pick a date", value: "pick" },
];

const PERIODS: { value: Period; glyph: string; label: string }[] = [
  { value: "morning",   glyph: "🌅", label: "Morning" },
  { value: "afternoon", glyph: "⛅", label: "Afternoon" },
  { value: "night",     glyph: "🌙", label: "Night" },
];

const WHO: { value: Who; glyph: string; label: string }[] = [
  { value: "solo", glyph: "🚶", label: "Solo" },
  { value: "couple", glyph: "💞", label: "Couple" },
  { value: "family", glyph: "👨‍👩‍👧", label: "Family" },
  { value: "friends", glyph: "🥂", label: "Friends" },
];

const VIBES: { value: VibeKey; glyph: string; label: string }[] = [
  { value: "outdoors_active", glyph: "⛰️", label: "Outdoors" },
  { value: "wine_food", glyph: "🍇", label: "Wine & Food" },
  { value: "arts_culture", glyph: "🎨", label: "Arts & Culture" },
  { value: "date_night", glyph: "🍷", label: "Date Night" },
  { value: "catch_a_show", glyph: "🎭", label: "Catch a Show" },
  { value: "nightlife", glyph: "🍸", label: "Nightlife" },
  { value: "hosting_visitors", glyph: "🎟️", label: "Showing Visitors" },
  { value: "free_sb", glyph: "💸", label: "Free SB" },
];

const ZONE_OPTS: { value: Zone | null; label: string }[] = [
  { value: null, label: "Anywhere" },
  { value: "downtown", label: "Downtown" },
  { value: "funk", label: "Funk Zone" },
  { value: "waterfront", label: "Waterfront" },
  { value: "mesa", label: "The Mesa" },
  { value: "montecito", label: "Montecito" },
  { value: "goleta", label: "Goleta" },
];

interface PlanSetupProps {
  onShowDay: (answers: PlanAnswers) => void;
}

export function PlanSetup({ onShowDay }: PlanSetupProps) {
  const [when, setWhen] = useState<WhenChoice>("today");
  const [pickDate, setPickDate] = useState<string>(todayISO());
  const [zone, setZone] = useState<Zone | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [who, setWho] = useState<Who | null>(null);
  const [vibes, setVibes] = useState<VibeKey[]>([]);
  const [fineOpen, setFineOpen] = useState(false);
  const [whereOpen, setWhereOpen] = useState(false);

  const dateISO = useMemo(() => {
    if (when === "tomorrow") return shiftISO(todayISO(), 1);
    if (when === "pick") return pickDate;
    return todayISO();
  }, [when, pickDate]);

  const dayChoices = useMemo(() => nextDays(14), []);
  const zoneLabel = ZONE_OPTS.find((o) => o.value === zone)?.label ?? "Anywhere";

  function togglePeriod(p: Period) {
    setPeriods((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }
  function toggleVibe(v: VibeKey) {
    setVibes((prev) =>
      prev.includes(v) ? prev.filter((x) => x !== v) : [...prev, v],
    );
  }
  function buildDay() {
    onShowDay({ dateISO, periods, who: who ?? "friends", vibes, zone });
  }

  const canBuild = periods.length > 0;

  return (
    <>
      <PlanHeader />
      <main id="main" className="sbd-shell__main sbd-plan-setup">
        {/* When — segmented */}
        <p className="sbd-miniq" id="plan-when-label">
          When
        </p>
        <SegmentedControl
          options={WHEN_OPTIONS}
          value={when}
          onChange={(v) => setWhen(v as WhenChoice)}
          ariaLabel="When are you out?"
        />
        {when === "pick" ? (
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
                  <span className="sbd-daychip__wd" aria-hidden="true">
                    {mon !== prevMon ? mon : wd}
                  </span>
                  <span className="sbd-daychip__d" aria-hidden="true">
                    {day}
                  </span>
                </button>
              );
            })}
          </div>
        ) : null}

        {/* Where — selector row → picker sheet */}
        <p className="sbd-miniq">Where</p>
        <button
          type="button"
          className="sbd-selrow"
          onClick={() => setWhereOpen(true)}
          aria-haspopup="dialog"
        >
          <span className="sbd-selrow__lab">
            <span aria-hidden="true">📍</span> Area
          </span>
          <span className="sbd-selrow__val">
            {zoneLabel} <span aria-hidden="true">▾</span>
          </span>
        </button>

        {/* Time of day — always visible, multi-select; selection = spine sections */}
        <p className="sbd-miniq">Time of day</p>
        <div
          className="sbd-q__row sbd-q__row--span"
          role="group"
          aria-label="Which parts of the day?"
        >
          {PERIODS.map((p) => (
            <button
              key={p.value}
              type="button"
              className="sbd-qbtn"
              aria-pressed={periods.includes(p.value)}
              onClick={() => togglePeriod(p.value)}
            >
              <span className="sbd-qbtn__g" aria-hidden="true">
                {p.glyph}
              </span>
              <span className="sbd-qbtn__tx">{p.label}</span>
            </button>
          ))}
        </div>

        {/* Fine-tune — collapsed soft signals */}
        <div className="sbd-finetune">
          <button
            type="button"
            className={`sbd-finetune__btn${fineOpen ? " sbd-finetune__btn--open" : ""}`}
            aria-expanded={fineOpen}
            aria-controls="plan-finetune-panel"
            onClick={() => setFineOpen((o) => !o)}
          >
            <span aria-hidden="true">{fineOpen ? "−" : "＋"}</span>
            <span>Fine-tune your day</span>
            <span
              className={`sbd-finetune__cv${fineOpen ? " sbd-finetune__cv--open" : ""}`}
              aria-hidden="true"
            >
              ▾
            </span>
          </button>
          <div
            className="sbd-ftpanel"
            id="plan-finetune-panel"
            hidden={!fineOpen}
          >
            <p className="sbd-miniq">Who&rsquo;s with you</p>
            <div
              className="sbd-q__row sbd-q__row--span"
              role="group"
              aria-label="Who's with you?"
            >
              {WHO.map((w) => (
                <button
                  key={w.value}
                  type="button"
                  className="sbd-qbtn"
                  aria-pressed={who !== null && who === w.value}
                  onClick={() => setWho(w.value)}
                >
                  <span className="sbd-qbtn__g" aria-hidden="true">
                    {w.glyph}
                  </span>
                  <span className="sbd-qbtn__tx">{w.label}</span>
                </button>
              ))}
            </div>

            <p className="sbd-miniq">Vibe</p>
            <div
              className="sbd-q__row"
              role="group"
              aria-label="What's the vibe?"
            >
              {VIBES.map((v) => (
                <button
                  key={v.value}
                  type="button"
                  className="sbd-qbtn"
                  aria-pressed={vibes.includes(v.value)}
                  onClick={() => toggleVibe(v.value)}
                >
                  <span className="sbd-qbtn__g" aria-hidden="true">
                    {v.glyph}
                  </span>
                  {v.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </main>

      <div className="sbd-plan-gobar">
        <button
          type="button"
          className="sbd-btn sbd-btn--primary sbd-btn--block"
          onClick={buildDay}
          disabled={!canBuild}
          aria-disabled={!canBuild}
        >
          Build my day →
        </button>
      </div>

      {/* Where picker sheet */}
      <BottomSheet
        open={whereOpen}
        onClose={() => setWhereOpen(false)}
        kicker="Pick an area"
        title="Where are you headed?"
      >
        <ul className="sbd-zonelist">
          {ZONE_OPTS.map((o) => (
            <li key={o.label}>
              <button
                type="button"
                className="sbd-zoneopt"
                aria-pressed={zone === o.value}
                onClick={() => {
                  setZone(o.value);
                  setWhereOpen(false);
                }}
              >
                <span>{o.label}</span>
                <span className="sbd-zoneopt__ck" aria-hidden="true">
                  {zone === o.value ? "✓" : ""}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}
